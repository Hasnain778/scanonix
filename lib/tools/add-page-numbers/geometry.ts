/**
 * Visible-box page number geometry (Phase 122B).
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
import type { PageNumberPosition } from "./types";

export { createCropPageGeometry, type CropPageGeometry };

export interface PageNumberLocalAnchor {
  localX: number;
  localY: number;
}

export interface PageNumberPdfDrawOptions {
  x: number;
  y: number;
  size: number;
  rotate: Rotation;
  color: Color;
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

function isTopPosition(position: PageNumberPosition): boolean {
  return position.startsWith("top-");
}

function isLeftPosition(position: PageNumberPosition): boolean {
  return position.endsWith("-left");
}

function isCenterPosition(position: PageNumberPosition): boolean {
  return position.endsWith("-center");
}

/**
 * Compute drawText anchor in visible-local space (top-left origin, y down).
 *
 * localX/localY are the baseline-left point for upright text before page rotation
 * compensation is applied via drawText rotate.
 */
export function computePageNumberAnchor(
  geometry: CropPageGeometry,
  position: PageNumberPosition,
  margin: number,
  textWidth: number,
  fontSize: number,
): PageNumberLocalAnchor {
  const { visualWidth, visualHeight } = geometry;

  let localX: number;

  if (isLeftPosition(position)) {
    localX = margin;
  } else if (isCenterPosition(position)) {
    localX = (visualWidth - textWidth) / 2;
  } else {
    localX = visualWidth - margin - textWidth;
  }

  const localY = isTopPosition(position)
    ? margin + fontSize
    : visualHeight - margin;

  return { localX, localY };
}

/** Normalized anchor fractions for preview overlay (top-left origin). */
export function localAnchorToNormalized(
  anchor: PageNumberLocalAnchor,
  geometry: CropPageGeometry,
): { normX: number; normY: number } {
  const { visualWidth, visualHeight } = geometry;
  return {
    normX: anchor.localX / visualWidth,
    normY: anchor.localY / visualHeight,
  };
}

/** Convert visible-local anchor to pdf-lib drawText options with upright text. */
export function localAnchorToPdfDrawOptions(
  anchor: PageNumberLocalAnchor,
  geometry: CropPageGeometry,
  fontSize: number,
  color: { r: number; g: number; b: number },
): PageNumberPdfDrawOptions {
  const pdfPoint = visibleLocalPointToPdf(anchor.localX, anchor.localY, geometry);

  return {
    x: pdfPoint.x,
    y: pdfPoint.y,
    size: fontSize,
    rotate: degrees(-geometry.rotation),
    color: rgb(color.r, color.g, color.b),
  };
}

/**
 * Validate measured text fits inside the visible box with the requested margin.
 * Uses baseline-left anchor semantics from computePageNumberAnchor.
 */
export function validateTextFitsInVisibleBox(
  geometry: CropPageGeometry,
  position: PageNumberPosition,
  margin: number,
  textWidth: number,
  fontSize: number,
): boolean {
  const { visualWidth, visualHeight } = geometry;
  const anchor = computePageNumberAnchor(
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

  const textTop = isTopPosition(position)
    ? margin
    : anchor.localY - fontSize;
  const textBottom = isTopPosition(position)
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

export function createPageNumberGeometry(
  mediaBox: PdfBox,
  cropBox: PdfBox,
  rotationDegrees: number,
): CropPageGeometry {
  return createCropPageGeometry(mediaBox, cropBox, rotationDegrees);
}
