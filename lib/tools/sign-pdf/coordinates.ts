import type {
  NormalizedPlacement,
  PageGeometry,
  PageRotation,
  PdfRect,
  PreviewRect,
} from "./types";

/**
 * Visual dimensions match PDF.js getViewport({ scale: 1, rotation }) width/height.
 * Media box comes from pdf-lib page.getSize(); rotation from page.getRotation().angle.
 */
export function normalizePageRotation(angle: number): PageRotation {
  const normalized = ((Math.round(angle) % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  return 0;
}

export function getVisualDimensions(
  mediaWidth: number,
  mediaHeight: number,
  rotation: PageRotation,
): { visualWidth: number; visualHeight: number } {
  if (rotation === 90 || rotation === 270) {
    return { visualWidth: mediaHeight, visualHeight: mediaWidth };
  }
  return { visualWidth: mediaWidth, visualHeight: mediaHeight };
}

export function createPageGeometry(
  mediaWidth: number,
  mediaHeight: number,
  rotationDegrees: number,
): PageGeometry {
  const rotation = normalizePageRotation(rotationDegrees);
  const { visualWidth, visualHeight } = getVisualDimensions(
    mediaWidth,
    mediaHeight,
    rotation,
  );

  return {
    mediaWidth,
    mediaHeight,
    rotation,
    visualWidth,
    visualHeight,
  };
}

/** Convert preview DOM pixels → normalized fractions (stable across preview resize). */
export function previewRectToNormalized(
  rect: PreviewRect,
  previewWidth: number,
  previewHeight: number,
): Pick<NormalizedPlacement, "normX" | "normY" | "normWidth" | "normHeight"> {
  if (previewWidth <= 0 || previewHeight <= 0) {
    throw new Error("Preview dimensions must be positive.");
  }

  return {
    normX: rect.x / previewWidth,
    normY: rect.y / previewHeight,
    normWidth: rect.width / previewWidth,
    normHeight: rect.height / previewHeight,
  };
}

/** Convert normalized placement → preview pixels at any preview size. */
export function normalizedToPreviewRect(
  placement: Pick<
    NormalizedPlacement,
    "normX" | "normY" | "normWidth" | "normHeight"
  >,
  previewWidth: number,
  previewHeight: number,
): PreviewRect {
  return {
    x: placement.normX * previewWidth,
    y: placement.normY * previewHeight,
    width: placement.normWidth * previewWidth,
    height: placement.normHeight * previewHeight,
  };
}

/**
 * Convert a visual-space point (top-left origin) to PDF user space (bottom-left origin).
 * Matches PDF.js viewport.convertToPdfPoint for the same rotation/media box.
 */
export function convertVisualPointToPdf(
  visualX: number,
  visualY: number,
  geometry: PageGeometry,
): { x: number; y: number } {
  const { mediaWidth: w, mediaHeight: h, rotation } = geometry;

  switch (rotation) {
    case 0:
      return { x: visualX, y: h - visualY };
    case 90:
      return { x: visualY, y: w - visualX };
    case 180:
      return { x: w - visualX, y: visualY };
    case 270:
      return { x: w - visualY, y: visualX };
    default:
      return { x: visualX, y: h - visualY };
  }
}

/**
 * Map normalized visual placement → pdf-lib drawImage rectangle.
 * Overlay uses top-left anchor; pdf-lib uses bottom-left anchor for y.
 */
export function normalizedPlacementToPdfRect(
  placement: Pick<
    NormalizedPlacement,
    "normX" | "normY" | "normWidth" | "normHeight"
  >,
  geometry: PageGeometry,
): PdfRect {
  const { visualWidth, visualHeight } = geometry;

  const visualX = placement.normX * visualWidth;
  const visualY = placement.normY * visualHeight;
  const visualWidthPx = placement.normWidth * visualWidth;
  const visualHeightPx = placement.normHeight * visualHeight;

  const bottomLeft = convertVisualPointToPdf(
    visualX,
    visualY + visualHeightPx,
    geometry,
  );
  const bottomRight = convertVisualPointToPdf(
    visualX + visualWidthPx,
    visualY + visualHeightPx,
    geometry,
  );
  const topLeft = convertVisualPointToPdf(visualX, visualY, geometry);

  const pdfWidth = Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y);
  const pdfHeight = Math.hypot(topLeft.x - bottomLeft.x, topLeft.y - bottomLeft.y);

  return {
    x: bottomLeft.x,
    y: bottomLeft.y,
    width: pdfWidth,
    height: pdfHeight,
  };
}

/** Convenience: preview pixels at known preview size → PDF rect. */
export function previewRectToPdfRect(
  rect: PreviewRect,
  previewWidth: number,
  previewHeight: number,
  geometry: PageGeometry,
): PdfRect {
  const normalized = previewRectToNormalized(rect, previewWidth, previewHeight);
  return normalizedPlacementToPdfRect(normalized, geometry);
}

export function clampNormalizedPlacement(
  placement: Pick<
    NormalizedPlacement,
    "normX" | "normY" | "normWidth" | "normHeight"
  >,
): Pick<NormalizedPlacement, "normX" | "normY" | "normWidth" | "normHeight"> {
  const normWidth = Math.max(0.001, Math.min(1, placement.normWidth));
  const normHeight = Math.max(0.001, Math.min(1, placement.normHeight));
  const normX = Math.max(0, Math.min(1 - normWidth, placement.normX));
  const normY = Math.max(0, Math.min(1 - normHeight, placement.normY));

  return { normX, normY, normWidth, normHeight };
}
