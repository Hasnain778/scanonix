/** PDF.js preview render scheduling for Watermark PDF client (Phase 124C-FIX2). */

import type { CropPreviewRenderPlan } from "@/lib/tools/crop-pdf/preview-render";
import {
  computeCropPreviewRenderPlan,
  createPreviewGeometry,
} from "./preview-ui";
import type { WatermarkPageEntry } from "./types";
import { computeWatermarkEditorContainerWidth } from "./workspace-ui";

export const WATERMARK_PREVIEW_CONTAINER_WIDTH_EPSILON = 1;

export interface WatermarkPreviewDisplaySize {
  width: number;
  height: number;
  plan: CropPreviewRenderPlan;
}

export interface WatermarkPreviewPdfRenderDeps {
  pdfByteLength: number;
  sourcePageIndex: number;
  intrinsicRotation: number;
  containerWidth: number;
}

export interface WatermarkPreviewOverlayState {
  position: string;
  rotationDegrees: number;
  opacityPercent: number;
  fontSize: number;
  text: string;
}

/** CSS display size for the preview canvas — derived from page geometry, not PDF.js. */
export function computeWatermarkPreviewDisplaySize(
  pageEntry: WatermarkPageEntry,
  containerWidth: number,
  devicePixelRatio = 1,
): WatermarkPreviewDisplaySize {
  const geometry = createPreviewGeometry(pageEntry);
  const plan = computeCropPreviewRenderPlan({
    viewportWidth: geometry.visualWidth,
    viewportHeight: geometry.visualHeight,
    containerCssWidth: containerWidth,
    devicePixelRatio,
  });

  return {
    width: plan.cssWidth,
    height: plan.cssHeight,
    plan,
  };
}

export function getWatermarkPreviewPdfRenderKey(
  deps: WatermarkPreviewPdfRenderDeps,
): string {
  return `${deps.pdfByteLength}:${deps.sourcePageIndex}:${deps.intrinsicRotation}:${deps.containerWidth}`;
}

/** Only commit container width when the measured value changes meaningfully. */
export function shouldUpdateWatermarkPreviewContainerWidth(
  currentWidth: number,
  measuredClientWidth: number,
): boolean {
  const nextWidth = computeWatermarkEditorContainerWidth(measuredClientWidth);
  return Math.abs(nextWidth - currentWidth) >= WATERMARK_PREVIEW_CONTAINER_WIDTH_EPSILON;
}

export function resolveWatermarkPreviewContainerWidth(
  currentWidth: number,
  measuredClientWidth: number,
): number {
  if (shouldUpdateWatermarkPreviewContainerWidth(currentWidth, measuredClientWidth)) {
    return computeWatermarkEditorContainerWidth(measuredClientWidth);
  }
  return currentWidth;
}

/**
 * Tracks PDF.js render vs overlay update counts for FIX2 regression tests.
 * Mirrors the decoupling contract used by WatermarkPdfPreview.
 */
export class WatermarkPreviewRenderTracker {
  private pdfRenderCountInternal = 0;
  private lastRenderKey: string | null = null;
  private overlayState: WatermarkPreviewOverlayState | null = null;
  private overlayUpdateCountInternal = 0;

  get pdfRenderCount(): number {
    return this.pdfRenderCountInternal;
  }

  get overlayUpdateCount(): number {
    return this.overlayUpdateCountInternal;
  }

  get currentOverlayState(): WatermarkPreviewOverlayState | null {
    return this.overlayState;
  }

  /** Returns true when a new PDF.js render should start. */
  maybeRenderPdf(deps: WatermarkPreviewPdfRenderDeps): boolean {
    const key = getWatermarkPreviewPdfRenderKey(deps);
    if (this.lastRenderKey === key) {
      return false;
    }

    this.lastRenderKey = key;
    this.pdfRenderCountInternal += 1;
    return true;
  }

  /** Watermark setting changes update overlay only — never PDF.js. */
  updateOverlay(next: WatermarkPreviewOverlayState): void {
    this.overlayState = next;
    this.overlayUpdateCountInternal += 1;
  }

  applyMeasuredContainerWidth(currentWidth: number, measuredClientWidth: number): number {
    return resolveWatermarkPreviewContainerWidth(currentWidth, measuredClientWidth);
  }
}
