/**
 * Visible-box watermark geometry (Phase 124B).
 *
 * Reuses Crop PDF exported helpers; copies visible-local → PDF conversion
 * because visibleLocalPointToPdf is not exported from crop-pdf/coordinates.ts.
 */

import { degrees, rgb, type Color, type Rotation } from "pdf-lib";
import {
  createCropPageGeometry,
  type CropPageGeometry,
} from "@/lib/tools/crop-pdf/coordinates";
import type { PdfBox } from "@/lib/tools/crop-pdf/types";
import type { WatermarkPosition } from "./types";

export { createCropPageGeometry, type CropPageGeometry };

export interface WatermarkLocalAnchor {
  localX: number;
  localY: number;
}

export interface WatermarkPdfDrawOptions {
  x: number;
  y: number;
  rotate: Rotation;
  color?: Color;
}

interface VisibleBasis {
  origin: { x: number; y: number };
  xAxis: { x: number; y: number };
  yAxis: { x: number; y: number };
}

/** PDF origin + basis vectors for visible-box-local visual coordinates. */
function getVisibleBasis(visibleBox: PdfBox, rotation: 0 | 90 | 180 | 270): VisibleBasis {
  const vb = visibleBox;

  switch (rotation) {
    case 0:
      return {
        origin: { x: vb.x, y: vb.y + vb.height },
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: -1 },
      };
    case 90:
      return {
        origin: { x: vb.x, y: vb.y + vb.width },
        xAxis: { x: 0, y: -1 },
        yAxis: { x: 1, y: 0 },
      };
    case 180:
      return {
        origin: { x: vb.x + vb.width, y: vb.y },
        xAxis: { x: -1, y: 0 },
        yAxis: { x: 0, y: 1 },
      };
    case 270:
      return {
        origin: { x: vb.x + vb.width, y: vb.y },
        xAxis: { x: 0, y: 1 },
        yAxis: { x: -1, y: 0 },
      };
    default:
      return {
        origin: { x: vb.x, y: vb.y + vb.height },
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: -1 },
      };
  }
}

/** Visible-local point (top-left origin) → PDF user space. Mirrors Crop PDF. */
export function visibleLocalPointToPdf(
  localX: number,
  localY: number,
  geometry: CropPageGeometry,
): { x: number; y: number } {
  const { origin, xAxis, yAxis } = getVisibleBasis(
    geometry.visibleBox,
    geometry.rotation,
  );

  return {
    x: origin.x + localX * xAxis.x + localY * yAxis.x,
    y: origin.y + localX * xAxis.y + localY * yAxis.y,
  };
}

function isTopPosition(position: WatermarkPosition): boolean {
  return position.startsWith("top-");
}

function isLeftPosition(position: WatermarkPosition): boolean {
  return position.endsWith("-left");
}

function isCenterPosition(position: WatermarkPosition): boolean {
  return position.endsWith("-center") || position === "center";
}

function isRightPosition(position: WatermarkPosition): boolean {
  return position.endsWith("-right");
}

function resolveHorizontalLocalX(
  position: WatermarkPosition,
  visualWidth: number,
  margin: number,
  contentWidth: number,
): number {
  if (isLeftPosition(position)) {
    return margin;
  }

  if (isCenterPosition(position)) {
    return (visualWidth - contentWidth) / 2;
  }

  if (isRightPosition(position)) {
    return visualWidth - margin - contentWidth;
  }

  return margin;
}

/** Axis-aligned extents of an image rotated around its bottom-left corner (y-down local). */
export interface RotatedImageExtents {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function computeRotatedImageExtents(
  imageWidth: number,
  imageHeight: number,
  rotationDegrees: number,
): RotatedImageExtents {
  if (rotationDegrees === 0) {
    return {
      minX: 0,
      maxX: imageWidth,
      minY: -imageHeight,
      maxY: 0,
    };
  }

  const radians = (rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const corners = [
    { x: 0, y: 0 },
    { x: imageWidth, y: 0 },
    { x: imageWidth, y: -imageHeight },
    { x: 0, y: -imageHeight },
  ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const corner of corners) {
    const x = corner.x * cos - corner.y * sin;
    const y = corner.x * sin + corner.y * cos;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Compute text watermark anchor in visible-local space (top-left origin, y down).
 *
 * localX/localY are the baseline-left point before page rotation compensation.
 */
export function computeTextWatermarkAnchor(
  geometry: CropPageGeometry,
  position: WatermarkPosition,
  margin: number,
  textWidth: number,
  fontSize: number,
): WatermarkLocalAnchor {
  const { visualWidth, visualHeight } = geometry;
  const localX = resolveHorizontalLocalX(position, visualWidth, margin, textWidth);

  let localY: number;
  if (position === "center") {
    localY = visualHeight / 2 + fontSize / 2;
  } else if (isTopPosition(position)) {
    localY = margin + fontSize;
  } else {
    localY = visualHeight - margin;
  }

  return { localX, localY };
}

/**
 * Compute image watermark anchor in visible-local space.
 *
 * The anchor is the bottom-left corner of the unrotated image before rotation.
 * Placement uses the final visual axis-aligned bounding box when rotated.
 */
export function computeImageWatermarkAnchor(
  geometry: CropPageGeometry,
  position: WatermarkPosition,
  margin: number,
  imageWidth: number,
  imageHeight: number,
  rotationDegrees = 0,
): WatermarkLocalAnchor {
  const { visualWidth, visualHeight } = geometry;
  const extents = computeRotatedImageExtents(
    imageWidth,
    imageHeight,
    rotationDegrees,
  );

  let localX: number;
  if (isLeftPosition(position)) {
    localX = margin - extents.minX;
  } else if (isCenterPosition(position)) {
    localX = visualWidth / 2 - (extents.minX + extents.maxX) / 2;
  } else if (isRightPosition(position)) {
    localX = visualWidth - margin - extents.maxX;
  } else {
    localX = margin - extents.minX;
  }

  let localY: number;
  if (position === "center") {
    localY = visualHeight / 2 - (extents.minY + extents.maxY) / 2;
  } else if (isTopPosition(position)) {
    localY = margin - extents.minY;
  } else {
    localY = visualHeight - margin - extents.maxY;
  }

  return { localX, localY };
}

/** Compute image draw size from visible width ratio, preserving aspect ratio. */
export function computeImageDrawSize(
  geometry: CropPageGeometry,
  intrinsicWidth: number,
  intrinsicHeight: number,
  relativeWidthRatio: number,
): { width: number; height: number } {
  const targetWidth = geometry.visualWidth * relativeWidthRatio;
  const scale = targetWidth / intrinsicWidth;
  return {
    width: targetWidth,
    height: intrinsicHeight * scale,
  };
}

/** Combine intrinsic page rotation with user rotation for upright-relative drawing. */
export function computeWatermarkDrawRotation(
  geometry: CropPageGeometry,
  userRotationDegrees: number,
): Rotation {
  return degrees(-geometry.rotation + userRotationDegrees);
}

/** Convert visible-local anchor to pdf-lib drawText/drawImage options. */
export function localAnchorToPdfDrawOptions(
  anchor: WatermarkLocalAnchor,
  geometry: CropPageGeometry,
  userRotationDegrees: number,
  color?: { r: number; g: number; b: number },
): WatermarkPdfDrawOptions {
  const pdfPoint = visibleLocalPointToPdf(anchor.localX, anchor.localY, geometry);

  return {
    x: pdfPoint.x,
    y: pdfPoint.y,
    rotate: computeWatermarkDrawRotation(geometry, userRotationDegrees),
    color: color ? rgb(color.r, color.g, color.b) : undefined,
  };
}

/** Normalized anchor fractions for preview overlay (top-left origin). */
export function localAnchorToNormalized(
  anchor: WatermarkLocalAnchor,
  geometry: CropPageGeometry,
): { normX: number; normY: number } {
  const { visualWidth, visualHeight } = geometry;
  return {
    normX: anchor.localX / visualWidth,
    normY: anchor.localY / visualHeight,
  };
}

/**
 * Validate measured text fits inside the visible box with the requested margin.
 */
export function validateTextFitsInVisibleBox(
  geometry: CropPageGeometry,
  position: WatermarkPosition,
  margin: number,
  textWidth: number,
  fontSize: number,
): boolean {
  const { visualWidth, visualHeight } = geometry;
  const anchor = computeTextWatermarkAnchor(
    geometry,
    position,
    margin,
    textWidth,
    fontSize,
  );

  if (
    !Number.isFinite(anchor.localX) ||
    !Number.isFinite(anchor.localY) ||
    anchor.localX < margin - 1e-6 ||
    anchor.localX + textWidth > visualWidth - margin + 1e-6
  ) {
    return false;
  }

  const textTop =
    position === "center"
      ? anchor.localY - fontSize / 2
      : isTopPosition(position)
        ? margin
        : anchor.localY - fontSize;
  const textBottom =
    position === "center"
      ? anchor.localY + fontSize / 2
      : isTopPosition(position)
        ? anchor.localY
        : visualHeight - margin;

  if (textTop < margin - 1e-6 || textBottom > visualHeight - margin + 1e-6) {
    return false;
  }

  if (visualWidth < 2 * margin || visualHeight < 2 * margin + fontSize) {
    return false;
  }

  return true;
}

/**
 * Validate image watermark fits inside the visible box with the requested margin.
 */
export function validateImageFitsInVisibleBox(
  geometry: CropPageGeometry,
  position: WatermarkPosition,
  margin: number,
  imageWidth: number,
  imageHeight: number,
  rotationDegrees = 0,
): boolean {
  const { visualWidth, visualHeight } = geometry;
  const anchor = computeImageWatermarkAnchor(
    geometry,
    position,
    margin,
    imageWidth,
    imageHeight,
    rotationDegrees,
  );
  const extents = computeRotatedImageExtents(
    imageWidth,
    imageHeight,
    rotationDegrees,
  );

  const visualLeft = anchor.localX + extents.minX;
  const visualRight = anchor.localX + extents.maxX;
  const visualTop = anchor.localY + extents.minY;
  const visualBottom = anchor.localY + extents.maxY;

  if (
    visualLeft < margin - 1e-6 ||
    visualTop < margin - 1e-6 ||
    visualRight > visualWidth - margin + 1e-6 ||
    visualBottom > visualHeight - margin + 1e-6
  ) {
    return false;
  }

  if (
    visualWidth < 2 * margin + (extents.maxX - extents.minX) ||
    visualHeight < 2 * margin + (extents.maxY - extents.minY)
  ) {
    return false;
  }

  return true;
}

export function createWatermarkPageGeometry(
  mediaBox: PdfBox,
  cropBox: PdfBox,
  rotationDegrees: number,
): CropPageGeometry {
  return createCropPageGeometry(mediaBox, cropBox, rotationDegrees);
}
