/** DPR-aware full-page preview rendering plan for Crop PDF workspace (Phase 121C). */

export const CROP_PREVIEW_MAX_CSS_WIDTH = 920;
export const CROP_PREVIEW_MIN_CSS_WIDTH = 280;
export const CROP_PREVIEW_MAX_DPR = 2;
export const CROP_PREVIEW_MAX_CANVAS_LONG_EDGE = 2400;
export const CROP_PREVIEW_JPEG_QUALITY = 0.92;

export interface CropPreviewRenderPlan {
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
}

export interface ComputeCropPreviewRenderPlanOptions {
  viewportWidth: number;
  viewportHeight: number;
  containerCssWidth: number;
  devicePixelRatio?: number;
  maxDpr?: number;
  maxCanvasLongEdge?: number;
}

export function clampCropPreviewDevicePixelRatio(
  devicePixelRatio: number,
  maxDpr: number = CROP_PREVIEW_MAX_DPR,
): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    return 1;
  }
  return Math.min(Math.max(devicePixelRatio, 1), maxDpr);
}

export function computeCropPreviewContainerWidth(clientWidth: number): number {
  return Math.min(
    CROP_PREVIEW_MAX_CSS_WIDTH,
    Math.max(CROP_PREVIEW_MIN_CSS_WIDTH, clientWidth - 48),
  );
}

/**
 * Compute PDF.js viewport scale so the preview backing store matches the
 * displayed editor size (accounting for devicePixelRatio) without oversized canvases.
 */
export function computeCropPreviewRenderPlan(
  options: ComputeCropPreviewRenderPlanOptions,
): CropPreviewRenderPlan {
  const {
    viewportWidth,
    viewportHeight,
    containerCssWidth,
    devicePixelRatio = 1,
    maxDpr = CROP_PREVIEW_MAX_DPR,
    maxCanvasLongEdge = CROP_PREVIEW_MAX_CANVAS_LONG_EDGE,
  } = options;

  const cssWidth = Math.max(1, containerCssWidth);
  const aspect = viewportHeight / viewportWidth;
  const cssHeight = cssWidth * aspect;

  const dpr = clampCropPreviewDevicePixelRatio(devicePixelRatio, maxDpr);
  let canvasWidth = cssWidth * dpr;
  let canvasHeight = cssHeight * dpr;

  const longEdge = Math.max(canvasWidth, canvasHeight);
  if (longEdge > maxCanvasLongEdge) {
    const factor = maxCanvasLongEdge / longEdge;
    canvasWidth *= factor;
    canvasHeight *= factor;
  }

  const scale = canvasWidth / viewportWidth;

  return {
    scale,
    canvasWidth: Math.round(canvasWidth),
    canvasHeight: Math.round(canvasHeight),
    cssWidth,
    cssHeight,
    devicePixelRatio: dpr,
  };
}
