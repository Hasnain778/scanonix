/**
 * Shared document renderer — IE-4B.
 *
 * Pipeline:
 *   source
 *   → crop / rotate / flip
 *   → filter (scaled by intensity) + manual adjustments  [image content only]
 *   → place on canvas
 *   → canvas background (behind content)
 *   → text objects (above image; not filtered)
 *   → export
 *   → viewport (preview only)
 */

import {
  applyAdjustmentsForPreview,
  applyAdjustmentsToCanvas,
  isNeutralAdjustments,
} from "@/lib/image-editor/adjustments";
import { normalizeHex } from "@/lib/image-editor/background";
import type { EditorDocument, EditorViewport } from "@/lib/image-editor/document";
import { composeImageAdjustments } from "@/lib/image-editor/filters";
import {
  computeContentPlacement,
  getCanvasFrameLayout,
  getCanvasOutputSize,
  getEditedImageSize,
  stagePointToCanvasPoint,
  type Size,
} from "@/lib/image-editor/geometry";
import {
  createCanvasMeasureWidth,
  drawTextObjects,
  findTextById,
  getTextSelectionCorners,
} from "@/lib/image-editor/text";

export interface RenderSource {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export function getComposedAdjustments(doc: EditorDocument) {
  return composeImageAdjustments(doc.filter, doc.adjustments);
}

/**
 * Render crop → rotation → flip at edited-image resolution.
 */
export function renderEditedImage(
  source: RenderSource,
  doc: EditorDocument,
  options?: { ignoreCrop?: boolean },
): HTMLCanvasElement {
  const sourceSize: Size = { width: source.width, height: source.height };
  const crop = options?.ignoreCrop
    ? { x: 0, y: 0, width: source.width, height: source.height }
    : (doc.crop ?? {
        x: 0,
        y: 0,
        width: source.width,
        height: source.height,
      });

  const editDoc = options?.ignoreCrop ? { ...doc, crop: null } : doc;
  const out = getEditedImageSize(sourceSize, editDoc);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, out.width);
  canvas.height = Math.max(1, out.height);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D is not available.");
  }

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((doc.rotation * Math.PI) / 180);
  if (doc.flipX || doc.flipY) {
    ctx.scale(doc.flipX ? -1 : 1, doc.flipY ? -1 : 1);
  }
  ctx.drawImage(
    source.canvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    -crop.width / 2,
    -crop.height / 2,
    crop.width,
    crop.height,
  );
  ctx.restore();

  return canvas;
}

function fillCanvasBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  doc: EditorDocument,
): void {
  if (doc.background.type === "color") {
    ctx.fillStyle = normalizeHex(doc.background.color);
    ctx.fillRect(0, 0, width, height);
  }
  // transparent: leave clear
}

/** Draw subtle checkerboard into a CSS-pixel rect (UI only). */
export function fillTransparencyCheckerboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cell = 10,
  theme: "bright" | "dark" = "dark",
): void {
  const light = theme === "bright" ? "#f3f4f6" : "#2a2d38";
  const dark = theme === "bright" ? "#d1d5db" : "#1a1d27";
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let yy = 0; yy < h; yy += cell) {
    for (let xx = 0; xx < w; xx += cell) {
      const col = ((Math.floor(xx / cell) + Math.floor(yy / cell)) % 2 === 0
        ? light
        : dark);
      ctx.fillStyle = col;
      ctx.fillRect(x + xx, y + yy, cell, cell);
    }
  }
  ctx.restore();
}

/**
 * Full output canvas at document pixel size. Viewport never applied.
 * Background → image (filtered) → text overlays.
 */
export function renderDocumentToCanvas(
  source: RenderSource | null,
  doc: EditorDocument,
  options?: { preview?: boolean; maxPreviewEdge?: number },
): HTMLCanvasElement {
  const canvasSize = getCanvasOutputSize(doc.canvas);
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize.width;
  canvas.height = canvasSize.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D is not available.");
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  fillCanvasBackground(ctx, canvas.width, canvas.height, doc);

  if (source && source.width > 0 && source.height > 0) {
    const edited = renderEditedImage(source, doc);
    const logicalSize = { width: edited.width, height: edited.height };
    const placement = computeContentPlacement(
      logicalSize,
      canvasSize,
      doc.content,
    );

    const composed = getComposedAdjustments(doc);
    let toPlace = edited;
    if (!isNeutralAdjustments(composed)) {
      toPlace = options?.preview
        ? applyAdjustmentsForPreview(
            edited,
            composed,
            options.maxPreviewEdge ?? 1280,
          )
        : applyAdjustmentsToCanvas(edited, composed);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      toPlace,
      placement.x,
      placement.y,
      placement.drawWidth,
      placement.drawHeight,
    );
  }

  // Text is document content above image; never filtered/adjusted.
  if (doc.texts.length) {
    drawTextObjects(ctx, doc.texts);
  }

  return canvas;
}

/**
 * Apply only a filter (+ optional intensity) for thumbnail generation —
 * ignores manual adjustments and uses a small source canvas.
 */
export function renderFilterThumbnail(
  source: RenderSource,
  doc: EditorDocument,
  filterId: string,
  maxEdge = 96,
): HTMLCanvasElement {
  const thumbDoc: EditorDocument = {
    ...doc,
    filter: { filterId, intensity: 100 },
    adjustments: {
      brightness: 0,
      exposure: 0,
      contrast: 0,
      highlights: 0,
      shadows: 0,
      saturation: 0,
      vibrance: 0,
      temperature: 0,
      tint: 0,
      sharpness: 0,
      blur: 0,
      grayscale: 0,
    },
    // Fit thumbnail into a square-ish canvas matching aspect of edited image
    canvas: { ...doc.canvas },
    content: { mode: "fit", scale: 1, offsetX: 0, offsetY: 0 },
    crop: null,
    rotation: 0,
    flipX: false,
    flipY: false,
    background: { type: "transparent", color: "#ffffff" },
    texts: [],
  };

  // Build a small source
  const sw = source.width;
  const sh = source.height;
  const edge = Math.max(sw, sh);
  const scale = edge > maxEdge ? maxEdge / edge : 1;
  const pw = Math.max(1, Math.round(sw * scale));
  const ph = Math.max(1, Math.round(sh * scale));
  const small = document.createElement("canvas");
  small.width = pw;
  small.height = ph;
  const sctx = small.getContext("2d");
  if (!sctx) return small;
  sctx.drawImage(source.canvas, 0, 0, pw, ph);

  thumbDoc.canvas = { width: pw, height: ph, presetId: null };
  return renderDocumentToCanvas(
    { canvas: small, width: pw, height: ph },
    thumbDoc,
    { preview: false },
  );
}

export function paintStage(
  stage: HTMLCanvasElement,
  source: RenderSource | null,
  doc: EditorDocument,
  viewport: EditorViewport,
  options: {
    cssWidth: number;
    cssHeight: number;
    dpr: number;
    showUncropped?: boolean;
    pasteboard?: string;
    canvasFill?: string;
    theme?: "bright" | "dark";
    /** Editor-only; never part of export. */
    selectedTextId?: string | null;
    onFrameLayout?: (layout: ReturnType<typeof getCanvasFrameLayout>) => void;
  },
): void {
  const dpr = Math.max(1, options.dpr || 1);
  const cssW = Math.max(1, Math.floor(options.cssWidth));
  const cssH = Math.max(1, Math.floor(options.cssHeight));
  const theme = options.theme ?? "dark";

  stage.width = Math.max(1, Math.floor(cssW * dpr));
  stage.height = Math.max(1, Math.floor(cssH * dpr));
  stage.style.width = `${cssW}px`;
  stage.style.height = `${cssH}px`;

  const ctx = stage.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const pasteboard = options.pasteboard ?? "#12141a";
  ctx.fillStyle = pasteboard;
  ctx.fillRect(0, 0, cssW, cssH);

  const canvasSize = getCanvasOutputSize(doc.canvas);
  const stageCss: Size = { width: cssW, height: cssH };

  const paintFrameUnderlay = (
    layout: ReturnType<typeof getCanvasFrameLayout>,
  ) => {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 28 * Math.min(1, layout.scale);
    ctx.shadowOffsetY = 10;
    if (doc.background.type === "transparent" && !options.showUncropped) {
      ctx.fillStyle = theme === "bright" ? "#ffffff" : "#1a1d27";
      ctx.fillRect(layout.frameX, layout.frameY, layout.frameWidth, layout.frameHeight);
      ctx.shadowColor = "transparent";
      fillTransparencyCheckerboard(
        ctx,
        layout.frameX,
        layout.frameY,
        layout.frameWidth,
        layout.frameHeight,
        10,
        theme,
      );
    } else {
      ctx.fillStyle =
        doc.background.type === "color"
          ? normalizeHex(doc.background.color)
          : (options.canvasFill ?? "#ffffff");
      ctx.fillRect(layout.frameX, layout.frameY, layout.frameWidth, layout.frameHeight);
    }
    ctx.restore();
  };

  const paintSelection = (
    layout: ReturnType<typeof getCanvasFrameLayout>,
    textsDoc: EditorDocument,
  ) => {
    const id = options.selectedTextId;
    if (!id || options.showUncropped) return;
    const textObj = findTextById(textsDoc.texts, id);
    if (!textObj) return;
    const measureCtx = document.createElement("canvas").getContext("2d");
    if (!measureCtx) return;
    const measure = createCanvasMeasureWidth(measureCtx, textObj);
    const corners = getTextSelectionCorners(textObj, measure, 8);
    if (corners.length < 4) return;
    ctx.save();
    ctx.beginPath();
    corners.forEach((c, i) => {
      const sx = layout.frameX + c.x * layout.scale;
      const sy = layout.frameY + c.y * layout.scale;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.strokeStyle = "color-mix(in srgb, var(--scanonix-orange) 85%, white)";
    // Fallback if color-mix unsupported in canvas — use solid accent
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.restore();
  };

  let documentCanvas: HTMLCanvasElement;
  let drawLayout: ReturnType<typeof getCanvasFrameLayout>;

  try {
    if (!source) {
      documentCanvas = renderDocumentToCanvas(null, doc, { preview: true });
      drawLayout = getCanvasFrameLayout(canvasSize, stageCss, viewport);
    } else if (options.showUncropped) {
      let edited = renderEditedImage(source, { ...doc, crop: null });
      const composed = getComposedAdjustments(doc);
      if (!isNeutralAdjustments(composed)) {
        edited = applyAdjustmentsForPreview(edited, composed, 1280);
      }
      documentCanvas = edited;
      const frameSize = {
        width: getEditedImageSize(
          { width: source.width, height: source.height },
          { ...doc, crop: null },
        ).width,
        height: getEditedImageSize(
          { width: source.width, height: source.height },
          { ...doc, crop: null },
        ).height,
      };
      drawLayout = getCanvasFrameLayout(frameSize, stageCss, viewport);
    } else {
      documentCanvas = renderDocumentToCanvas(source, doc, { preview: true });
      drawLayout = getCanvasFrameLayout(canvasSize, stageCss, viewport);
    }
  } catch {
    return;
  }

  options.onFrameLayout?.(
    options.showUncropped
      ? drawLayout
      : getCanvasFrameLayout(canvasSize, stageCss, viewport),
  );

  const underlayLayout = options.showUncropped
    ? drawLayout
    : getCanvasFrameLayout(canvasSize, stageCss, viewport);

  paintFrameUnderlay(underlayLayout);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    documentCanvas,
    drawLayout.frameX,
    drawLayout.frameY,
    drawLayout.frameWidth,
    drawLayout.frameHeight,
  );

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    drawLayout.frameX + 0.5,
    drawLayout.frameY + 0.5,
    drawLayout.frameWidth - 1,
    drawLayout.frameHeight - 1,
  );

  if (!options.showUncropped) {
    paintSelection(underlayLayout, doc);
  }
}

/** Map a stage CSS client-relative point into canvas pixels (null if outside). */
export function stageClientToCanvasPoint(
  clientX: number,
  clientY: number,
  stageRect: { left: number; top: number },
  layout: ReturnType<typeof getCanvasFrameLayout>,
): { x: number; y: number } {
  return stagePointToCanvasPoint(
    { x: clientX - stageRect.left, y: clientY - stageRect.top },
    layout,
  );
}
