/** Fixed-DPI raster render plan for secure redaction export (Phase 125B). */

import {
  MAX_REDACT_CANVAS_LONG_EDGE,
  MAX_REDACT_CANVAS_PIXELS,
  REDACT_RENDER_SCALE,
} from "./limits";

export interface RedactPageRenderPlan {
  /** PDF.js viewport scale — fixed ~200 DPI, not devicePixelRatio dependent. */
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
  /** Visible page width in PDF points (scale 1). */
  pageWidthPt: number;
  /** Visible page height in PDF points (scale 1). */
  pageHeightPt: number;
}

export interface ComputeRedactPageRenderPlanOptions {
  viewportWidth: number;
  viewportHeight: number;
  renderScale?: number;
  maxCanvasLongEdge?: number;
  maxCanvasPixels?: number;
}

/**
 * Compute PDF.js viewport scale for ~200 DPI rasterization.
 * Deliberately ignores devicePixelRatio — security export uses fixed DPI.
 */
export function computeRedactPageRenderPlan(
  options: ComputeRedactPageRenderPlanOptions,
): RedactPageRenderPlan {
  const {
    viewportWidth,
    viewportHeight,
    renderScale = REDACT_RENDER_SCALE,
    maxCanvasLongEdge = MAX_REDACT_CANVAS_LONG_EDGE,
    maxCanvasPixels = MAX_REDACT_CANVAS_PIXELS,
  } = options;

  let canvasWidth = viewportWidth * renderScale;
  let canvasHeight = viewportHeight * renderScale;

  const longEdge = Math.max(canvasWidth, canvasHeight);
  if (longEdge > maxCanvasLongEdge) {
    const factor = maxCanvasLongEdge / longEdge;
    canvasWidth *= factor;
    canvasHeight *= factor;
  }

  const totalPixels = canvasWidth * canvasHeight;
  if (totalPixels > maxCanvasPixels) {
    const factor = Math.sqrt(maxCanvasPixels / totalPixels);
    canvasWidth *= factor;
    canvasHeight *= factor;
  }

  const scale = canvasWidth / viewportWidth;

  return {
    scale,
    canvasWidth: Math.round(canvasWidth),
    canvasHeight: Math.round(canvasHeight),
    pageWidthPt: viewportWidth,
    pageHeightPt: viewportHeight,
  };
}

export function exceedsRedactCanvasLimits(
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  const plan = computeRedactPageRenderPlan({ viewportWidth, viewportHeight });
  return (
    plan.canvasWidth <= 0 ||
    plan.canvasHeight <= 0 ||
    plan.canvasWidth * plan.canvasHeight > MAX_REDACT_CANVAS_PIXELS
  );
}
