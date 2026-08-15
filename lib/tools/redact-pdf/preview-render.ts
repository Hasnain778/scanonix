/** DPR-aware preview rendering plan for Redact PDF workspace (Phase 125C). */

export {
  CROP_PREVIEW_JPEG_QUALITY as REDACT_PREVIEW_JPEG_QUALITY,
  CROP_PREVIEW_MAX_CANVAS_LONG_EDGE as REDACT_PREVIEW_MAX_CANVAS_LONG_EDGE,
  CROP_PREVIEW_MAX_CSS_WIDTH as REDACT_PREVIEW_MAX_CSS_WIDTH,
  CROP_PREVIEW_MIN_CSS_WIDTH as REDACT_PREVIEW_MIN_CSS_WIDTH,
  clampCropPreviewDevicePixelRatio as clampRedactPreviewDevicePixelRatio,
  computeCropPreviewContainerWidth as computeRedactPreviewContainerWidth,
  computeCropPreviewRenderPlan as computeRedactPreviewRenderPlan,
  type CropPreviewRenderPlan as RedactPreviewRenderPlan,
} from "@/lib/tools/crop-pdf/preview-render";

import {
  computeCropPreviewRenderPlan,
  type CropPreviewRenderPlan,
} from "@/lib/tools/crop-pdf/preview-render";
import { getVisualDimensions } from "./coordinates";
import type { RedactionPageEntry } from "./types";

export interface RedactPreviewDisplaySize {
  width: number;
  height: number;
  plan: CropPreviewRenderPlan;
}

/** Base CSS display size for the page editor (before zoom multiplier). */
export function computeRedactPreviewDisplaySize(
  pageEntry: RedactionPageEntry,
  containerCssWidth: number,
  devicePixelRatio = 1,
): RedactPreviewDisplaySize {
  const { visualWidth, visualHeight } = getVisualDimensions(
    pageEntry.visibleBox.width,
    pageEntry.visibleBox.height,
    pageEntry.intrinsicRotation,
  );

  const plan = computeCropPreviewRenderPlan({
    viewportWidth: visualWidth,
    viewportHeight: visualHeight,
    containerCssWidth,
    devicePixelRatio,
  });

  return {
    width: plan.cssWidth,
    height: plan.cssHeight,
    plan,
  };
}

/** Apply zoom multiplier to CSS display size without touching normalized redactions. */
export function applyRedactPreviewZoom(
  baseWidth: number,
  baseHeight: number,
  zoom: number,
): { width: number; height: number } {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return {
    width: Math.max(1, baseWidth * safeZoom),
    height: Math.max(1, baseHeight * safeZoom),
  };
}
