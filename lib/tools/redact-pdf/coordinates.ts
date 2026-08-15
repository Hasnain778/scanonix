import {
  createCropPageGeometry,
  type CropPageGeometry,
} from "@/lib/tools/crop-pdf/coordinates";
import type { PdfBox } from "@/lib/tools/crop-pdf/types";
import { MIN_NORMALIZED_REDACTION_SIZE } from "./limits";
import type { NormalizedRedactionRect } from "./types";

export {
  computeVisibleBox,
  createCropPageGeometry,
  getVisualDimensions,
  normalizePageRotation,
  type CropPageGeometry,
} from "@/lib/tools/crop-pdf/coordinates";

export function createRedactionPageGeometry(
  mediaBox: PdfBox,
  cropBox: PdfBox,
  rotationDegrees: number,
): CropPageGeometry {
  return createCropPageGeometry(mediaBox, cropBox, rotationDegrees);
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

export function validateNormalizedRedaction(rect: NormalizedRedactionRect): boolean {
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
    rect.width < MIN_NORMALIZED_REDACTION_SIZE ||
    rect.height < MIN_NORMALIZED_REDACTION_SIZE
  ) {
    return false;
  }

  if (rect.x + rect.width > 1 + 1e-9 || rect.y + rect.height > 1 + 1e-9) {
    return false;
  }

  return true;
}

export function clampNormalizedRedaction(
  rect: NormalizedRedactionRect,
): NormalizedRedactionRect {
  const width = Math.max(
    MIN_NORMALIZED_REDACTION_SIZE,
    Math.min(1, rect.width),
  );
  const height = Math.max(
    MIN_NORMALIZED_REDACTION_SIZE,
    Math.min(1, rect.height),
  );
  const x = Math.max(0, Math.min(1 - width, rect.x));
  const y = Math.max(0, Math.min(1 - height, rect.y));

  return { x, y, width, height };
}

/** Convert normalized visible rects to pixel coordinates on a raster canvas. */
export function normalizedRedactionsToCanvasRects(
  redactions: NormalizedRedactionRect[],
  canvasWidth: number,
  canvasHeight: number,
): Array<{ x: number; y: number; width: number; height: number }> {
  return redactions.map((rect) => ({
    x: Math.floor(rect.x * canvasWidth),
    y: Math.floor(rect.y * canvasHeight),
    width: Math.ceil(rect.width * canvasWidth),
    height: Math.ceil(rect.height * canvasHeight),
  }));
}
