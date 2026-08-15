/** Preview overlay adapter for Watermark PDF workspace (Phase 124C). */

import {
  CROP_PREVIEW_JPEG_QUALITY,
  clampCropPreviewDevicePixelRatio,
  computeCropPreviewContainerWidth,
  computeCropPreviewRenderPlan,
} from "@/lib/tools/crop-pdf/preview-render";
import {
  computeImageDrawSize,
  computeImageWatermarkAnchor,
  computeTextWatermarkAnchor,
  createWatermarkPageGeometry,
  localAnchorToNormalized,
  type CropPageGeometry,
} from "./geometry";
import type { WatermarkPageEntry, WatermarkPosition } from "./types";

export {
  CROP_PREVIEW_JPEG_QUALITY,
  clampCropPreviewDevicePixelRatio,
  computeCropPreviewContainerWidth,
  computeCropPreviewRenderPlan,
};

export interface TextPreviewOverlayStyle {
  left: string;
  top: string;
  fontSize: number;
  color: string;
  opacity: number;
  transform: string;
  transformOrigin: string;
  fontWeight: number | string;
}

export interface ImagePreviewOverlayStyle {
  left: string;
  top?: string;
  bottom?: string;
  width: string;
  height: string;
  opacity: number;
  transform: string;
  transformOrigin: string;
}

export function createPreviewGeometry(pageEntry: WatermarkPageEntry): CropPageGeometry {
  return createWatermarkPageGeometry(
    pageEntry.mediaBox,
    pageEntry.cropBox,
    pageEntry.intrinsicRotation,
  );
}

function isTopPosition(position: WatermarkPosition): boolean {
  return position.startsWith("top-");
}

function isBottomPosition(position: WatermarkPosition): boolean {
  return position.startsWith("bottom-");
}

export function measurePreviewTextWidth(
  text: string,
  fontSize: number,
  bold: boolean,
): number {
  if (typeof document === "undefined") {
    return text.length * fontSize * (bold ? 0.55 : 0.5);
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return text.length * fontSize * (bold ? 0.55 : 0.5);
  }

  context.font = `${bold ? "bold " : ""}${fontSize}px Helvetica, Arial, sans-serif`;
  return context.measureText(text).width;
}

export interface ComputeTextPreviewOverlayStyleArgs {
  pageEntry: WatermarkPageEntry;
  position: WatermarkPosition;
  margin: number;
  fontSize: number;
  textWidth: number;
  color: string;
  opacity: number;
  rotationDegrees: number;
  bold: boolean;
  cssHeight: number;
}

/**
 * Map 124B text watermark geometry to CSS overlay coordinates for PDF.js preview.
 */
export function computeTextPreviewOverlayStyle(
  args: ComputeTextPreviewOverlayStyleArgs,
): TextPreviewOverlayStyle {
  const {
    pageEntry,
    position,
    margin,
    fontSize,
    textWidth,
    color,
    opacity,
    rotationDegrees,
    bold,
    cssHeight,
  } = args;

  const geometry = createPreviewGeometry(pageEntry);
  const anchor = computeTextWatermarkAnchor(
    geometry,
    position,
    margin,
    textWidth,
    fontSize,
  );
  const scale = cssHeight / geometry.visualHeight;
  const scaledFontSize = fontSize * scale;

  return {
    left: `${(anchor.localX / geometry.visualWidth) * 100}%`,
    top: `${(anchor.localY / geometry.visualHeight) * 100}%`,
    fontSize: scaledFontSize,
    color,
    opacity,
    transform: rotationDegrees === 0 ? "none" : `rotate(${rotationDegrees}deg)`,
    transformOrigin: "0% 100%",
    fontWeight: bold ? 700 : 400,
  };
}

export interface ComputeImagePreviewOverlayStyleArgs {
  pageEntry: WatermarkPageEntry;
  position: WatermarkPosition;
  margin: number;
  intrinsicWidth: number;
  intrinsicHeight: number;
  relativeWidthRatio: number;
  opacity: number;
  rotationDegrees: number;
}

/**
 * Map 124B image watermark geometry to CSS overlay coordinates for PDF.js preview.
 */
export function computeImagePreviewOverlayStyle(
  args: ComputeImagePreviewOverlayStyleArgs,
): ImagePreviewOverlayStyle {
  const {
    pageEntry,
    position,
    margin,
    intrinsicWidth,
    intrinsicHeight,
    relativeWidthRatio,
    opacity,
    rotationDegrees,
  } = args;

  const geometry = createPreviewGeometry(pageEntry);
  const { width: imageWidth, height: imageHeight } = computeImageDrawSize(
    geometry,
    intrinsicWidth,
    intrinsicHeight,
    relativeWidthRatio,
  );
  const anchor = computeImageWatermarkAnchor(
    geometry,
    position,
    margin,
    imageWidth,
    imageHeight,
    rotationDegrees,
  );

  const cssTopPercent =
    ((anchor.localY - imageHeight) / geometry.visualHeight) * 100;
  const cssBottomPercent =
    ((geometry.visualHeight - anchor.localY) / geometry.visualHeight) * 100;

  const style: ImagePreviewOverlayStyle = {
    left: `${(anchor.localX / geometry.visualWidth) * 100}%`,
    width: `${(imageWidth / geometry.visualWidth) * 100}%`,
    height: `${(imageHeight / geometry.visualHeight) * 100}%`,
    opacity,
    transform: rotationDegrees === 0 ? "none" : `rotate(${rotationDegrees}deg)`,
    transformOrigin: "0% 100%",
  };

  if (isBottomPosition(position)) {
    style.bottom = `${cssBottomPercent}%`;
  } else {
    style.top = `${cssTopPercent}%`;
  }

  return style;
}

export interface PreviewOverlayNormalizedResult {
  geometry: CropPageGeometry;
  anchor: { localX: number; localY: number };
  normalized: { normX: number; normY: number };
}

/** Exposed for tests — geometry → normalized preview fractions. */
export function computeTextPreviewOverlayNormalized(
  pageEntry: WatermarkPageEntry,
  position: WatermarkPosition,
  margin: number,
  textWidth: number,
  fontSize: number,
): PreviewOverlayNormalizedResult {
  const geometry = createPreviewGeometry(pageEntry);
  const anchor = computeTextWatermarkAnchor(
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

export function computeImagePreviewDimensions(
  pageEntry: WatermarkPageEntry,
  intrinsicWidth: number,
  intrinsicHeight: number,
  relativeWidthRatio: number,
): { width: number; height: number; aspectRatio: number } {
  const geometry = createPreviewGeometry(pageEntry);
  const { width, height } = computeImageDrawSize(
    geometry,
    intrinsicWidth,
    intrinsicHeight,
    relativeWidthRatio,
  );

  return {
    width,
    height,
    aspectRatio: width / height,
  };
}

export function isTopWatermarkPosition(position: WatermarkPosition): boolean {
  return isTopPosition(position);
}

export function isBottomWatermarkPosition(position: WatermarkPosition): boolean {
  return isBottomPosition(position);
}
