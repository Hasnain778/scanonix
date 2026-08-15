/** Preview overlay adapter for Add Page Numbers workspace (Phase 122C). */

import {
  CROP_PREVIEW_JPEG_QUALITY,
  clampCropPreviewDevicePixelRatio,
  computeCropPreviewContainerWidth,
  computeCropPreviewRenderPlan,
} from "@/lib/tools/crop-pdf/preview-render";
import {
  computePageNumberAnchor,
  createPageNumberGeometry,
  localAnchorToNormalized,
  type CropPageGeometry,
} from "./geometry";
import type { PageNumberPageEntry, PageNumberPosition } from "./types";

export {
  CROP_PREVIEW_JPEG_QUALITY,
  clampCropPreviewDevicePixelRatio,
  computeCropPreviewContainerWidth,
  computeCropPreviewRenderPlan,
};

export interface PreviewOverlayStyle {
  left: string;
  top?: string;
  bottom?: string;
  fontSize: number;
  color: string;
}

export interface ComputePreviewOverlayStyleArgs {
  pageEntry: PageNumberPageEntry;
  position: PageNumberPosition;
  margin: number;
  fontSize: number;
  textWidth: number;
  color: string;
  cssHeight: number;
}

export function createPreviewGeometry(pageEntry: PageNumberPageEntry): CropPageGeometry {
  return createPageNumberGeometry(
    pageEntry.mediaBox,
    pageEntry.cropBox,
    pageEntry.intrinsicRotation,
  );
}

/**
 * Map engine geometry to CSS overlay coordinates for the PDF.js preview.
 * Uses 122B anchor math — margin-aligned vertical placement, anchor-based horizontal.
 */
export function computePreviewOverlayStyle(
  args: ComputePreviewOverlayStyleArgs,
): PreviewOverlayStyle {
  const { pageEntry, position, margin, fontSize, textWidth, color, cssHeight } = args;
  const geometry = createPreviewGeometry(pageEntry);
  const anchor = computePageNumberAnchor(
    geometry,
    position,
    margin,
    textWidth,
    fontSize,
  );
  const isTop = position.startsWith("top-");
  const scale = cssHeight / geometry.visualHeight;
  const scaledFontSize = fontSize * scale;

  const style: PreviewOverlayStyle = {
    left: `${(anchor.localX / geometry.visualWidth) * 100}%`,
    fontSize: scaledFontSize,
    color,
  };

  if (isTop) {
    style.top = `${(margin / geometry.visualHeight) * 100}%`;
  } else {
    style.bottom = `${(margin / geometry.visualHeight) * 100}%`;
  }

  return style;
}

export interface PreviewOverlayNormalizedResult {
  geometry: CropPageGeometry;
  anchor: { localX: number; localY: number };
  normalized: { normX: number; normY: number };
}

/** Exposed for tests — geometry → normalized preview fractions. */
export function computePreviewOverlayNormalized(
  pageEntry: PageNumberPageEntry,
  position: PageNumberPosition,
  margin: number,
  textWidth: number,
  fontSize: number,
): PreviewOverlayNormalizedResult {
  const geometry = createPreviewGeometry(pageEntry);
  const anchor = computePageNumberAnchor(
    geometry,
    position,
    margin,
    textWidth,
    fontSize,
  );

  return {
    geometry,
    anchor,
    normalized: localAnchorToNormalized(anchor, geometry),
  };
}
