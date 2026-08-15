import { computeVisibleBox, normalizePageRotation } from "@/lib/tools/crop-pdf/coordinates";
import type { PdfBox } from "@/lib/tools/crop-pdf/types";
import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import { detectExistingDigitalSignatures } from "./detect-signatures";
import { MAX_WATERMARK_PDF_BYTES, MAX_WATERMARK_PDF_PAGES } from "./limits";
import type { WatermarkDocumentState, WatermarkPageEntry } from "./types";
import { WatermarkPdfError } from "./types";

export interface LoadWatermarkDocumentOptions {
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

export async function loadWatermarkDocumentState(
  pdfBytes: ArrayBuffer,
  options: LoadWatermarkDocumentOptions = {},
): Promise<WatermarkDocumentState> {
  const byteLength = options.byteLength ?? pdfBytes.byteLength;

  if (byteLength > MAX_WATERMARK_PDF_BYTES) {
    throw new WatermarkPdfError(
      "FILE_TOO_LARGE",
      `This PDF exceeds the ${Math.round(MAX_WATERMARK_PDF_BYTES / (1024 * 1024))}MB size limit.`,
    );
  }

  let pdf;

  try {
    pdf = await loadPdfDocument(pdfBytes);
  } catch (error) {
    if (error instanceof PdfLoadError) {
      throw new WatermarkPdfError(
        error.code === "PASSWORD" ? "PASSWORD_PDF" : "CORRUPT_PDF",
        error.message,
      );
    }

    throw new WatermarkPdfError(
      "CORRUPT_PDF",
      error instanceof Error ? error.message : "Could not read this PDF.",
    );
  }

  const pageCount = pdf.getPageCount();
  if (pageCount === 0) {
    throw new WatermarkPdfError(
      "CORRUPT_PDF",
      "This PDF contains no pages to watermark.",
    );
  }

  if (pageCount > MAX_WATERMARK_PDF_PAGES) {
    throw new WatermarkPdfError(
      "TOO_MANY_PAGES",
      `This PDF has ${pageCount} pages. The maximum supported is ${MAX_WATERMARK_PDF_PAGES}.`,
    );
  }

  const pages: WatermarkPageEntry[] = pdf.getPages().map((page, sourcePageIndex) => {
    const mediaBox = readPdfBox(page.getMediaBox());
    const cropBox = readPdfBox(page.getCropBox());
    const visibleBox = computeVisibleBox(mediaBox, cropBox);

    return {
      sourcePageIndex,
      intrinsicRotation: normalizePageRotation(page.getRotation().angle),
      mediaBox,
      cropBox,
      visibleBox,
    };
  });

  return {
    pageCount,
    pages,
    hasExistingDigitalSignatures: detectExistingDigitalSignatures(pdfBytes),
  };
}
