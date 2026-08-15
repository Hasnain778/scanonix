import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import { createFileId } from "@/lib/utils/format";
import {
  computeVisibleBox,
  createCropPageGeometry,
  normalizePageRotation,
  pdfCropBoxToNormalized,
} from "./coordinates";
import { MAX_CROP_PDF_BYTES, MAX_CROP_PDF_PAGES } from "./limits";
import type { CropDocumentState, CropPageEntry, PdfBox } from "./types";
import { CropPdfError } from "./types";

export interface LoadCropDocumentOptions {
  /** When provided, reject PDFs larger than MAX_CROP_PDF_BYTES. */
  byteLength?: number;
}

function readPdfBox(box: {
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

export async function loadCropDocumentState(
  pdfBytes: ArrayBuffer,
  options: LoadCropDocumentOptions = {},
): Promise<CropDocumentState> {
  if (
    options.byteLength !== undefined &&
    options.byteLength > MAX_CROP_PDF_BYTES
  ) {
    throw new CropPdfError(
      "FILE_TOO_LARGE",
      `This PDF exceeds the ${Math.round(MAX_CROP_PDF_BYTES / (1024 * 1024))}MB size limit.`,
    );
  }

  if (pdfBytes.byteLength > MAX_CROP_PDF_BYTES) {
    throw new CropPdfError(
      "FILE_TOO_LARGE",
      `This PDF exceeds the ${Math.round(MAX_CROP_PDF_BYTES / (1024 * 1024))}MB size limit.`,
    );
  }

  let pdf;

  try {
    pdf = await loadPdfDocument(pdfBytes);
  } catch (error) {
    if (error instanceof PdfLoadError) {
      throw new CropPdfError(
        error.code === "PASSWORD" ? "PASSWORD_PDF" : "CORRUPT_PDF",
        error.message,
      );
    }

    throw new CropPdfError(
      "CORRUPT_PDF",
      error instanceof Error ? error.message : "Could not read this PDF.",
    );
  }

  const pageCount = pdf.getPageCount();
  if (pageCount === 0) {
    throw new CropPdfError(
      "CORRUPT_PDF",
      "This PDF contains no pages to crop.",
    );
  }

  if (pageCount > MAX_CROP_PDF_PAGES) {
    throw new CropPdfError(
      "TOO_MANY_PAGES",
      `This PDF has ${pageCount} pages. The maximum supported is ${MAX_CROP_PDF_PAGES}.`,
    );
  }

  const pages: CropPageEntry[] = pdf.getPages().map((page, sourcePageIndex) => {
    const mediaBox = readPdfBox(page.getMediaBox());
    const originalCropBox = readPdfBox(page.getCropBox());
    const visibleBox = computeVisibleBox(mediaBox, originalCropBox);
    const geometry = createCropPageGeometry(
      mediaBox,
      originalCropBox,
      page.getRotation().angle,
    );
    const normalizedCropRect = pdfCropBoxToNormalized(
      originalCropBox,
      geometry,
    );

    return {
      id: createFileId(),
      sourcePageIndex,
      intrinsicRotation: normalizePageRotation(page.getRotation().angle),
      mediaBox,
      originalCropBox,
      visibleBox,
      normalizedCropRect,
      hasCustomCrop: false,
    };
  });

  return { pages };
}
