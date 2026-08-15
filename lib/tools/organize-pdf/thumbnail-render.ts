import { configurePdfWorker } from "@/lib/pdf/configure-worker";
import { loadPdfDocument } from "@/lib/tools/pdf-to-image/pdf-render";
import { getEffectiveRotation } from "./rotation";
import type { OrganizePageEntry, OrganizePageRotation } from "./types";

/** Target longest visual edge in CSS pixels before devicePixelRatio. */
export const ORGANIZE_THUMBNAIL_TARGET_CSS_LONG_EDGE = 320;

/** Maximum devicePixelRatio applied to thumbnail backing resolution. */
export const ORGANIZE_THUMBNAIL_MAX_DPR = 2;

/** Hard cap on canvas longest edge to limit memory for large documents. */
export const ORGANIZE_THUMBNAIL_MAX_CANVAS_LONG_EDGE = 720;

/** JPEG quality for preview thumbnails (preview-only, not export). */
export const ORGANIZE_THUMBNAIL_JPEG_QUALITY = 0.88;

export interface OrganizeThumbnailRenderPlan {
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
  devicePixelRatio: number;
  targetLongEdge: number;
}

export interface ComputeOrganizeThumbnailRenderPlanOptions {
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio?: number;
  targetCssLongEdge?: number;
  maxDpr?: number;
  maxCanvasLongEdge?: number;
}

export function clampOrganizeThumbnailDevicePixelRatio(
  devicePixelRatio: number,
  maxDpr: number = ORGANIZE_THUMBNAIL_MAX_DPR,
): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    return 1;
  }
  return Math.min(Math.max(devicePixelRatio, 1), maxDpr);
}

/**
 * Compute PDF.js viewport scale so the thumbnail backing store matches the
 * displayed card size (accounting for devicePixelRatio) without oversized canvases.
 */
export function computeOrganizeThumbnailRenderPlan(
  options: ComputeOrganizeThumbnailRenderPlanOptions,
): OrganizeThumbnailRenderPlan {
  const {
    viewportWidth,
    viewportHeight,
    devicePixelRatio = 1,
    targetCssLongEdge = ORGANIZE_THUMBNAIL_TARGET_CSS_LONG_EDGE,
    maxDpr = ORGANIZE_THUMBNAIL_MAX_DPR,
    maxCanvasLongEdge = ORGANIZE_THUMBNAIL_MAX_CANVAS_LONG_EDGE,
  } = options;

  const dpr = clampOrganizeThumbnailDevicePixelRatio(devicePixelRatio, maxDpr);
  const visualLongEdge = Math.max(viewportWidth, viewportHeight);
  const targetLongEdge = Math.min(targetCssLongEdge * dpr, maxCanvasLongEdge);
  const scale = targetLongEdge / visualLongEdge;

  return {
    scale,
    canvasWidth: viewportWidth * scale,
    canvasHeight: viewportHeight * scale,
    devicePixelRatio: dpr,
    targetLongEdge,
  };
}

export interface RenderOrganizePageThumbnailOptions {
  devicePixelRatio?: number;
  targetCssLongEdge?: number;
}

export async function renderOrganizePageThumbnailUrl(
  pdfBytes: ArrayBuffer,
  entry: Pick<
    OrganizePageEntry,
    "sourcePageIndex" | "intrinsicRotation" | "rotationDelta"
  >,
  options: RenderOrganizePageThumbnailOptions = {},
): Promise<string> {
  await configurePdfWorker();
  const pdf = await loadPdfDocument(pdfBytes);

  const rotation = getEffectiveRotation(
    entry.intrinsicRotation,
    entry.rotationDelta,
  );
  const page = await pdf.getPage(entry.sourcePageIndex + 1);
  const baseViewport = page.getViewport({ scale: 1, rotation });
  const plan = computeOrganizeThumbnailRenderPlan({
    viewportWidth: baseViewport.width,
    viewportHeight: baseViewport.height,
    devicePixelRatio:
      options.devicePixelRatio ??
      (typeof window !== "undefined" ? window.devicePixelRatio : 1),
    targetCssLongEdge: options.targetCssLongEdge,
  });
  const viewport = page.getViewport({ scale: plan.scale, rotation });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not supported in this browser.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (value) resolve(value);
        else reject(new Error("Failed to render page thumbnail."));
      },
      "image/jpeg",
      ORGANIZE_THUMBNAIL_JPEG_QUALITY,
    );
  });

  return URL.createObjectURL(blob);
}

export function getThumbnailAspectRatio(
  mediaWidth: number,
  mediaHeight: number,
  rotation: OrganizePageRotation,
): number {
  if (rotation === 90 || rotation === 270) {
    return mediaHeight / mediaWidth;
  }
  return mediaWidth / mediaHeight;
}

/**
 * @deprecated Pre-fix thumbnails used an effective ~42px long edge. Kept for tests/docs.
 */
export const LEGACY_ORGANIZE_THUMBNAIL_EFFECTIVE_LONG_EDGE = 42;
