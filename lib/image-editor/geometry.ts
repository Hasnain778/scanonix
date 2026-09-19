/**
 * Pure geometry for IE-3A image editor (no DOM).
 */

import type {
  ContentPlacementMode,
  ContentTransform,
  CropRatioId,
  CropRect,
  EditorCanvas,
  EditorDocument,
  EditorRotation,
  EditorViewport,
} from "@/lib/image-editor/document";
import { clampContentScale } from "@/lib/image-editor/document";

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ContentPlacement {
  /** Base scale for mode before user content.scale multiplier. */
  baseScale: number;
  /** Final draw scale = baseScale * content.scale */
  scale: number;
  /** Drawn image width in canvas pixels */
  drawWidth: number;
  /** Drawn image height in canvas pixels */
  drawHeight: number;
  /** Top-left X in canvas pixels */
  x: number;
  /** Top-left Y in canvas pixels */
  y: number;
}

/** Cropped source size before rotation. */
export function getCroppedSourceSize(
  source: Size,
  crop: CropRect | null,
): Size {
  if (!crop) {
    return { width: source.width, height: source.height };
  }
  return { width: crop.width, height: crop.height };
}

/** Edited image size after crop + rotation (before canvas placement). */
export function getEditedImageSize(
  source: Size,
  doc: Pick<EditorDocument, "crop" | "rotation">,
): Size {
  const cropped = getCroppedSourceSize(source, doc.crop);
  if (doc.rotation === 90 || doc.rotation === 270) {
    return { width: cropped.height, height: cropped.width };
  }
  return { width: cropped.width, height: cropped.height };
}

/** @deprecated IE-2 name — edited image size (not canvas output). */
export function getDocumentOutputSize(
  source: Size,
  doc: Pick<EditorDocument, "crop" | "rotation">,
): Size {
  return getEditedImageSize(source, doc);
}

/** Export / canvas output size. */
export function getCanvasOutputSize(canvas: EditorCanvas): Size {
  return {
    width: Math.max(1, canvas.width),
    height: Math.max(1, canvas.height),
  };
}

export function basePlacementScale(
  image: Size,
  canvas: Size,
  mode: ContentPlacementMode,
): number {
  const iw = Math.max(1, image.width);
  const ih = Math.max(1, image.height);
  const cw = Math.max(1, canvas.width);
  const ch = Math.max(1, canvas.height);
  if (mode === "fill") {
    return Math.max(cw / iw, ch / ih);
  }
  if (mode === "original") {
    return 1;
  }
  // fit
  return Math.min(cw / iw, ch / ih);
}

/**
 * Compute where the edited image sits inside the output canvas.
 * Viewport is intentionally not a parameter.
 */
export function computeContentPlacement(
  image: Size,
  canvas: Size,
  content: ContentTransform,
): ContentPlacement {
  const baseScale = basePlacementScale(image, canvas, content.mode);
  const scale = baseScale * clampContentScale(content.scale);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const centeredX = (canvas.width - drawWidth) / 2;
  const centeredY = (canvas.height - drawHeight) / 2;
  return {
    baseScale,
    scale,
    drawWidth,
    drawHeight,
    x: centeredX + content.offsetX,
    y: centeredY + content.offsetY,
  };
}

/** Soft pan bounds so the image stays overlapping the canvas. */
export function clampContentOffsets(
  image: Size,
  canvas: Size,
  content: ContentTransform,
  nextOffsetX: number,
  nextOffsetY: number,
): { offsetX: number; offsetY: number } {
  const placement = computeContentPlacement(image, canvas, {
    ...content,
    offsetX: 0,
    offsetY: 0,
  });
  const marginX = Math.max(placement.drawWidth, canvas.width) * 0.5;
  const marginY = Math.max(placement.drawHeight, canvas.height) * 0.5;
  return {
    offsetX: Math.min(marginX, Math.max(-marginX, nextOffsetX)),
    offsetY: Math.min(marginY, Math.max(-marginY, nextOffsetY)),
  };
}

export function clampCropRect(crop: CropRect, source: Size): CropRect {
  const maxW = Math.max(1, source.width);
  const maxH = Math.max(1, source.height);
  let width = Math.min(Math.max(1, Math.round(crop.width)), maxW);
  let height = Math.min(Math.max(1, Math.round(crop.height)), maxH);
  let x = Math.round(crop.x);
  let y = Math.round(crop.y);
  x = Math.min(Math.max(0, x), maxW - width);
  y = Math.min(Math.max(0, y), maxH - height);
  return { x, y, width, height };
}

export function fullImageCrop(source: Size): CropRect {
  return {
    x: 0,
    y: 0,
    width: Math.max(1, source.width),
    height: Math.max(1, source.height),
  };
}

export function isFullImageCrop(crop: CropRect | null, source: Size): boolean {
  if (!crop) return true;
  return (
    crop.x === 0 &&
    crop.y === 0 &&
    crop.width === source.width &&
    crop.height === source.height
  );
}

export function ratioValue(id: CropRatioId, source: Size): number | null {
  switch (id) {
    case "free":
      return null;
    case "original":
      return source.width / Math.max(1, source.height);
    case "1:1":
      return 1;
    case "4:3":
      return 4 / 3;
    case "16:9":
      return 16 / 9;
    default:
      return null;
  }
}

export function createCenteredRatioCrop(
  source: Size,
  ratioId: CropRatioId,
): CropRect {
  const ratio = ratioValue(ratioId, source);
  if (ratio === null) {
    return fullImageCrop(source);
  }

  const sourceRatio = source.width / Math.max(1, source.height);
  let width: number;
  let height: number;
  if (sourceRatio > ratio) {
    height = source.height;
    width = Math.max(1, Math.round(height * ratio));
  } else {
    width = source.width;
    height = Math.max(1, Math.round(width / ratio));
  }

  const x = Math.round((source.width - width) / 2);
  const y = Math.round((source.height - height) / 2);
  return clampCropRect({ x, y, width, height }, source);
}

export function resizeCropRect(
  current: CropRect,
  source: Size,
  next: Partial<CropRect>,
  ratioId: CropRatioId,
): CropRect {
  const ratio = ratioValue(ratioId, source);
  let nextCrop: CropRect = {
    x: next.x ?? current.x,
    y: next.y ?? current.y,
    width: next.width ?? current.width,
    height: next.height ?? current.height,
  };

  if (ratio !== null && Number.isFinite(ratio) && ratio > 0) {
    if (next.width !== undefined && next.height === undefined) {
      nextCrop.height = Math.max(1, Math.round(nextCrop.width / ratio));
    } else if (next.height !== undefined && next.width === undefined) {
      nextCrop.width = Math.max(1, Math.round(nextCrop.height * ratio));
    } else if (next.width !== undefined && next.height !== undefined) {
      const fromW = nextCrop.width / ratio;
      if (
        Math.abs(fromW - nextCrop.height) >
        Math.abs(nextCrop.height * ratio - nextCrop.width)
      ) {
        nextCrop.height = Math.max(1, Math.round(nextCrop.width / ratio));
      } else {
        nextCrop.width = Math.max(1, Math.round(nextCrop.height * ratio));
      }
    }
  }

  return clampCropRect(nextCrop, source);
}

export function moveCropRect(
  current: CropRect,
  source: Size,
  dx: number,
  dy: number,
): CropRect {
  return clampCropRect(
    {
      ...current,
      x: current.x + dx,
      y: current.y + dy,
    },
    source,
  );
}

/** Base fit scale so canvas fills stage while preserving aspect. */
export function computeFitScale(
  documentSize: Size,
  stageCss: Size,
  padding = 48,
): number {
  const availW = Math.max(1, stageCss.width - padding * 2);
  const availH = Math.max(1, stageCss.height - padding * 2);
  if (documentSize.width <= 0 || documentSize.height <= 0) return 1;
  return Math.min(availW / documentSize.width, availH / documentSize.height);
}

export function getEffectiveScale(
  documentSize: Size,
  stageCss: Size,
  viewport: EditorViewport,
  padding = 48,
): number {
  return computeFitScale(documentSize, stageCss, padding) * viewport.zoom;
}

export function stageToDocumentPoint(
  stagePoint: Point,
  documentSize: Size,
  stageCss: Size,
  viewport: EditorViewport,
  padding = 48,
): Point {
  const scale = getEffectiveScale(documentSize, stageCss, viewport, padding);
  const offsetX =
    (stageCss.width - documentSize.width * scale) / 2 + viewport.panX;
  const offsetY =
    (stageCss.height - documentSize.height * scale) / 2 + viewport.panY;
  return {
    x: (stagePoint.x - offsetX) / scale,
    y: (stagePoint.y - offsetY) / scale,
  };
}

export function documentToStagePoint(
  docPoint: Point,
  documentSize: Size,
  stageCss: Size,
  viewport: EditorViewport,
  padding = 48,
): Point {
  const scale = getEffectiveScale(documentSize, stageCss, viewport, padding);
  const offsetX =
    (stageCss.width - documentSize.width * scale) / 2 + viewport.panX;
  const offsetY =
    (stageCss.height - documentSize.height * scale) / 2 + viewport.panY;
  return {
    x: docPoint.x * scale + offsetX,
    y: docPoint.y * scale + offsetY,
  };
}

/** Exact on-stage rectangle of the output canvas (or crop frame size). */
export interface CanvasFrameLayout {
  cssWidth: number;
  cssHeight: number;
  frameX: number;
  frameY: number;
  frameWidth: number;
  frameHeight: number;
  /** Canvas pixels → stage CSS pixels */
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
}

export function getCanvasFrameLayout(
  canvasSize: Size,
  stageCss: Size,
  viewport: EditorViewport,
  padding = 48,
): CanvasFrameLayout {
  const scale = getEffectiveScale(canvasSize, stageCss, viewport, padding);
  const frameWidth = canvasSize.width * scale;
  const frameHeight = canvasSize.height * scale;
  const frameX = (stageCss.width - frameWidth) / 2 + viewport.panX;
  const frameY = (stageCss.height - frameHeight) / 2 + viewport.panY;
  return {
    cssWidth: stageCss.width,
    cssHeight: stageCss.height,
    frameX,
    frameY,
    frameWidth,
    frameHeight,
    scale,
    canvasWidth: canvasSize.width,
    canvasHeight: canvasSize.height,
  };
}

/** Stage CSS point → canvas pixel coordinates. */
export function stagePointToCanvasPoint(
  stagePoint: Point,
  layout: CanvasFrameLayout,
): Point {
  return {
    x: (stagePoint.x - layout.frameX) / layout.scale,
    y: (stagePoint.y - layout.frameY) / layout.scale,
  };
}

/** Convert a stage-CSS drag delta into canvas-pixel content offsets. */
export function stageDeltaToCanvasDelta(
  dxCss: number,
  dyCss: number,
  layout: CanvasFrameLayout,
): Point {
  const s = layout.scale || 1;
  return { x: dxCss / s, y: dyCss / s };
}

export function sourceToRotatedDocument(
  point: Point,
  source: Size,
  rotation: EditorRotation,
): Point {
  const { width: sw, height: sh } = source;
  switch (rotation) {
    case 90:
      return { x: sh - point.y, y: point.x };
    case 180:
      return { x: sw - point.x, y: sh - point.y };
    case 270:
      return { x: point.y, y: sw - point.x };
    default:
      return { x: point.x, y: point.y };
  }
}

export function rotatedDocumentToSource(
  point: Point,
  source: Size,
  rotation: EditorRotation,
): Point {
  const { width: sw, height: sh } = source;
  switch (rotation) {
    case 90:
      return { x: point.y, y: sh - point.x };
    case 180:
      return { x: sw - point.x, y: sh - point.y };
    case 270:
      return { x: sw - point.y, y: point.x };
    default:
      return { x: point.x, y: point.y };
  }
}

export function rotatedFullSize(source: Size, rotation: EditorRotation): Size {
  if (rotation === 90 || rotation === 270) {
    return { width: source.height, height: source.width };
  }
  return { width: source.width, height: source.height };
}

export function cropRectToRotatedBounds(
  crop: CropRect,
  source: Size,
  rotation: EditorRotation,
): CropRect {
  const corners: Point[] = [
    { x: crop.x, y: crop.y },
    { x: crop.x + crop.width, y: crop.y },
    { x: crop.x + crop.width, y: crop.y + crop.height },
    { x: crop.x, y: crop.y + crop.height },
  ].map((p) => sourceToRotatedDocument(p, source, rotation));

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}
