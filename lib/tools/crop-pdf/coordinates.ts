import { MIN_NORMALIZED_CROP_SIZE } from "./limits";
import type {
  CropPageRotation,
  NormalizedCropRect,
  PdfBox,
} from "./types";

/** Geometry needed for coordinate conversion on one page. */
export interface CropPageGeometry {
  mediaBox: PdfBox;
  visibleBox: PdfBox;
  rotation: CropPageRotation;
  /** Visible region width as rendered by PDF.js (scale 1). */
  visualWidth: number;
  /** Visible region height as rendered by PDF.js (scale 1). */
  visualHeight: number;
}

/** Normalize pdf-lib rotation angles to 0 | 90 | 180 | 270. */
export function normalizePageRotation(angle: number): CropPageRotation {
  const normalized = ((Math.round(angle) % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  return 0;
}

export function getVisualDimensions(
  boxWidth: number,
  boxHeight: number,
  rotation: CropPageRotation,
): { visualWidth: number; visualHeight: number } {
  if (rotation === 90 || rotation === 270) {
    return { visualWidth: boxHeight, visualHeight: boxWidth };
  }
  return { visualWidth: boxWidth, visualHeight: boxHeight };
}

/** Intersection of MediaBox and CropBox — the region PDF.js displays. */
export function computeVisibleBox(mediaBox: PdfBox, cropBox: PdfBox): PdfBox {
  const x1 = Math.max(mediaBox.x, cropBox.x);
  const y1 = Math.max(mediaBox.y, cropBox.y);
  const x2 = Math.min(mediaBox.x + mediaBox.width, cropBox.x + cropBox.width);
  const y2 = Math.min(mediaBox.y + mediaBox.height, cropBox.y + cropBox.height);

  return {
    x: x1,
    y: y1,
    width: Math.max(0, x2 - x1),
    height: Math.max(0, y2 - y1),
  };
}

export function createCropPageGeometry(
  mediaBox: PdfBox,
  cropBox: PdfBox,
  rotationDegrees: number,
): CropPageGeometry {
  const rotation = normalizePageRotation(rotationDegrees);
  const visibleBox = computeVisibleBox(mediaBox, cropBox);
  const { visualWidth, visualHeight } = getVisualDimensions(
    visibleBox.width,
    visibleBox.height,
    rotation,
  );

  return {
    mediaBox,
    visibleBox,
    rotation,
    visualWidth,
    visualHeight,
  };
}

interface VisibleBasis {
  origin: { x: number; y: number };
  xAxis: { x: number; y: number };
  yAxis: { x: number; y: number };
}

/** PDF origin + basis vectors for visible-box-local visual coordinates. */
function getVisibleBasis(visibleBox: PdfBox, rotation: CropPageRotation): VisibleBasis {
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

function visibleLocalPointToPdf(
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

function pdfPointToVisibleLocal(
  pdfX: number,
  pdfY: number,
  geometry: CropPageGeometry,
): { x: number; y: number } {
  const { origin, xAxis, yAxis } = getVisibleBasis(
    geometry.visibleBox,
    geometry.rotation,
  );

  const deltaX = pdfX - origin.x;
  const deltaY = pdfY - origin.y;

  // Solve 2x2: delta = localX * xAxis + localY * yAxis
  const det = xAxis.x * yAxis.y - xAxis.y * yAxis.x;
  const localX = (deltaX * yAxis.y - deltaY * yAxis.x) / det;
  const localY = (xAxis.x * deltaY - xAxis.y * deltaX) / det;

  return { x: localX, y: localY };
}

/** Top-left corner of the visible box in full-page visual coordinates. */
export function getVisibleBoxVisualOrigin(geometry: CropPageGeometry): {
  x: number;
  y: number;
} {
  const { mediaBox, rotation } = geometry;
  const originPdf = getVisibleBasis(geometry.visibleBox, rotation).origin;

  const mw = mediaBox.width;
  const mh = mediaBox.height;
  const ox = mediaBox.x;
  const oy = mediaBox.y;
  const localX = originPdf.x - ox;
  const localY = originPdf.y - oy;

  switch (rotation) {
    case 0:
      return { x: localX, y: mh - localY };
    case 90:
      return { x: mw - localY, y: localX };
    case 180:
      return { x: mw - localX, y: localY };
    case 270:
      return { x: localY, y: mw - localX };
    default:
      return { x: localX, y: mh - localY };
  }
}

/**
 * Convert a full-page visual point (top-left origin) to PDF user space.
 * Matches PDF.js viewport.convertToPdfPoint for the same rotation/media box.
 */
export function convertFullVisualPointToPdf(
  visualX: number,
  visualY: number,
  geometry: CropPageGeometry,
): { x: number; y: number } {
  const { mediaBox, rotation } = geometry;
  const mw = mediaBox.width;
  const mh = mediaBox.height;
  const ox = mediaBox.x;
  const oy = mediaBox.y;

  switch (rotation) {
    case 0:
      return { x: ox + visualX, y: oy + mh - visualY };
    case 90:
      return { x: ox + visualY, y: oy + mw - visualX };
    case 180:
      return { x: ox + mw - visualX, y: oy + visualY };
    case 270:
      return { x: ox + mw - visualY, y: oy + visualX };
    default:
      return { x: ox + visualX, y: oy + mh - visualY };
  }
}

/**
 * Convert normalized visual crop → absolute PDF CropBox for pdf-lib setCropBox.
 *
 * User crops what they SEE (visible box), not the full MediaBox.
 */
export function normalizedCropToPdfCropBox(
  normalizedRect: NormalizedCropRect,
  geometry: CropPageGeometry,
): PdfBox {
  const { visualWidth, visualHeight } = geometry;

  const visualX = normalizedRect.x * visualWidth;
  const visualY = normalizedRect.y * visualHeight;
  const visualW = normalizedRect.width * visualWidth;
  const visualH = normalizedRect.height * visualHeight;

  const topLeft = visibleLocalPointToPdf(visualX, visualY, geometry);
  const topRight = visibleLocalPointToPdf(visualX + visualW, visualY, geometry);
  const bottomLeft = visibleLocalPointToPdf(visualX, visualY + visualH, geometry);
  const bottomRight = visibleLocalPointToPdf(
    visualX + visualW,
    visualY + visualH,
    geometry,
  );

  const xs = [topLeft.x, topRight.x, bottomLeft.x, bottomRight.x];
  const ys = [topLeft.y, topRight.y, bottomLeft.y, bottomRight.y];

  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x,
    y,
    width: maxX - x,
    height: maxY - y,
  };
}

/** Inverse conversion — load existing CropBox or verify round-trip. */
export function pdfCropBoxToNormalized(
  pdfCropBox: PdfBox,
  geometry: CropPageGeometry,
): NormalizedCropRect {
  const { visualWidth, visualHeight } = geometry;

  const corners = [
    { x: pdfCropBox.x, y: pdfCropBox.y },
    { x: pdfCropBox.x + pdfCropBox.width, y: pdfCropBox.y },
    { x: pdfCropBox.x, y: pdfCropBox.y + pdfCropBox.height },
    {
      x: pdfCropBox.x + pdfCropBox.width,
      y: pdfCropBox.y + pdfCropBox.height,
    },
  ];

  const localCorners = corners.map((corner) =>
    pdfPointToVisibleLocal(corner.x, corner.y, geometry),
  );

  const minX = Math.min(...localCorners.map((point) => point.x));
  const maxX = Math.max(...localCorners.map((point) => point.x));
  const minY = Math.min(...localCorners.map((point) => point.y));
  const maxY = Math.max(...localCorners.map((point) => point.y));

  return {
    x: minX / visualWidth,
    y: minY / visualHeight,
    width: (maxX - minX) / visualWidth,
    height: (maxY - minY) / visualHeight,
  };
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

export function validateNormalizedCrop(rect: NormalizedCropRect): boolean {
  if (
    !isFiniteNumber(rect.x) ||
    !isFiniteNumber(rect.y) ||
    !isFiniteNumber(rect.width) ||
    !isFiniteNumber(rect.height)
  ) {
    return false;
  }

  if (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return false;
  }

  if (
    rect.width < MIN_NORMALIZED_CROP_SIZE ||
    rect.height < MIN_NORMALIZED_CROP_SIZE
  ) {
    return false;
  }

  if (rect.x + rect.width > 1 + 1e-9 || rect.y + rect.height > 1 + 1e-9) {
    return false;
  }

  return true;
}

export function clampNormalizedCrop(
  rect: NormalizedCropRect,
): NormalizedCropRect {
  const width = Math.max(MIN_NORMALIZED_CROP_SIZE, Math.min(1, rect.width));
  const height = Math.max(MIN_NORMALIZED_CROP_SIZE, Math.min(1, rect.height));
  const x = Math.max(0, Math.min(1 - width, rect.x));
  const y = Math.max(0, Math.min(1 - height, rect.y));

  return { x, y, width, height };
}

/** True when rect represents the full visible area (within tolerance). */
export function isFullVisibleCrop(rect: NormalizedCropRect): boolean {
  const epsilon = 1e-6;
  return (
    Math.abs(rect.x) <= epsilon &&
    Math.abs(rect.y) <= epsilon &&
    Math.abs(rect.width - 1) <= epsilon &&
    Math.abs(rect.height - 1) <= epsilon
  );
}
