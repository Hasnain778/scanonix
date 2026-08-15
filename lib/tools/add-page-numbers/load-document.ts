import { computeVisibleBox, normalizePageRotation } from "@/lib/tools/crop-pdf/coordinates";
import type { PdfBox } from "@/lib/tools/crop-pdf/types";
import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import { MAX_ADD_PAGE_NUMBERS_BYTES, MAX_ADD_PAGE_NUMBERS_PAGES } from "./limits";
import type { PageNumberDocumentState, PageNumberPageEntry } from "./types";
import { AddPageNumbersError } from "./types";

export interface LoadPageNumberDocumentOptions {
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

export async function loadPageNumberDocumentState(
  pdfBytes: ArrayBuffer,
  options: LoadPageNumberDocumentOptions = {},
): Promise<PageNumberDocumentState> {
  const byteLength = options.byteLength ?? pdfBytes.byteLength;

  if (byteLength > MAX_ADD_PAGE_NUMBERS_BYTES) {
    throw new AddPageNumbersError(
      "FILE_TOO_LARGE",
      `This PDF exceeds the ${Math.round(MAX_ADD_PAGE_NUMBERS_BYTES / (1024 * 1024))}MB size limit.`,
    );
  }

  let pdf;

  try {
    pdf = await loadPdfDocument(pdfBytes);
  } catch (error) {
    if (error instanceof PdfLoadError) {
      throw new AddPageNumbersError(
        error.code === "PASSWORD" ? "PASSWORD_PDF" : "CORRUPT_PDF",
        error.message,
      );
    }

    throw new AddPageNumbersError(
      "CORRUPT_PDF",
      error instanceof Error ? error.message : "Could not read this PDF.",
    );
  }

  const pageCount = pdf.getPageCount();
  if (pageCount === 0) {
    throw new AddPageNumbersError(
      "CORRUPT_PDF",
      "This PDF contains no pages to number.",
    );
  }

  if (pageCount > MAX_ADD_PAGE_NUMBERS_PAGES) {
    throw new AddPageNumbersError(
      "TOO_MANY_PAGES",
      `This PDF has ${pageCount} pages. The maximum supported is ${MAX_ADD_PAGE_NUMBERS_PAGES}.`,
    );
  }

  const pages: PageNumberPageEntry[] = pdf.getPages().map((page, sourcePageIndex) => {
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

  return { pageCount, pages };
}
