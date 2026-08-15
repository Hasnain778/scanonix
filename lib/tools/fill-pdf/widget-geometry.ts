import {
  createCropPageGeometry,
  pdfCropBoxToNormalized,
} from "../crop-pdf/coordinates";
import type { NormalizedCropRect, PdfBox } from "../crop-pdf/types";

export interface PageBoxContext {
  mediaBox: PdfBox;
  cropBox: PdfBox;
  rotationDegrees: number;
}

/**
 * Convert a widget / annotation Rect to normalized visual coordinates
 * relative to the page visible box (CropBox ∩ MediaBox).
 */
export function widgetRectToNormalizedVisual(
  widgetRect: PdfBox,
  pageContext: PageBoxContext,
): NormalizedCropRect {
  const geometry = createCropPageGeometry(
    pageContext.mediaBox,
    pageContext.cropBox,
    pageContext.rotationDegrees,
  );

  return pdfCropBoxToNormalized(widgetRect, geometry);
}

export function readPdfBox(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): PdfBox {
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
  };
}

export function isValidNormalizedWidgetRect(rect: NormalizedCropRect): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.x >= -1e-6 &&
    rect.y >= -1e-6 &&
    rect.x + rect.width <= 1 + 1e-6 &&
    rect.y + rect.height <= 1 + 1e-6
  );
}
