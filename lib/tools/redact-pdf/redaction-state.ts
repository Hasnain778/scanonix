import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import { createFileId } from "@/lib/utils/format";
import {
  computeVisibleBox,
  createRedactionPageGeometry,
  normalizePageRotation,
  validateNormalizedRedaction,
} from "./coordinates";
import {
  MAX_REDACT_PDF_BYTES,
  MAX_REDACT_PDF_PAGES,
  MAX_REDACTIONS,
  MAX_REDACTED_PAGES_SOFT,
} from "./limits";
import type { PdfBox } from "@/lib/tools/crop-pdf/types";
import type {
  NormalizedRedactionRect,
  RedactionDocumentState,
  RedactionPageEntry,
  RedactionRect,
} from "./types";
import { RedactPdfError } from "./types";

export interface LoadRedactionDocumentOptions {
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

export async function loadRedactionDocumentState(
  pdfBytes: ArrayBuffer,
  options: LoadRedactionDocumentOptions = {},
): Promise<RedactionDocumentState> {
  if (
    options.byteLength !== undefined &&
    options.byteLength > MAX_REDACT_PDF_BYTES
  ) {
    throw new RedactPdfError(
      "FILE_TOO_LARGE",
      `This PDF exceeds the ${Math.round(MAX_REDACT_PDF_BYTES / (1024 * 1024))}MB size limit.`,
    );
  }

  if (pdfBytes.byteLength > MAX_REDACT_PDF_BYTES) {
    throw new RedactPdfError(
      "FILE_TOO_LARGE",
      `This PDF exceeds the ${Math.round(MAX_REDACT_PDF_BYTES / (1024 * 1024))}MB size limit.`,
    );
  }

  let pdf;

  try {
    pdf = await loadPdfDocument(pdfBytes);
  } catch (error) {
    if (error instanceof PdfLoadError) {
      throw new RedactPdfError(
        error.code === "PASSWORD" ? "PASSWORD_PDF" : "CORRUPT_PDF",
        error.message,
      );
    }

    throw new RedactPdfError(
      "CORRUPT_PDF",
      error instanceof Error ? error.message : "Could not read this PDF.",
    );
  }

  const pageCount = pdf.getPageCount();
  if (pageCount === 0) {
    throw new RedactPdfError(
      "CORRUPT_PDF",
      "This PDF contains no pages to redact.",
    );
  }

  if (pageCount > MAX_REDACT_PDF_PAGES) {
    throw new RedactPdfError(
      "TOO_MANY_PAGES",
      `This PDF has ${pageCount} pages. The maximum supported is ${MAX_REDACT_PDF_PAGES}.`,
    );
  }

  const pages: RedactionPageEntry[] = pdf.getPages().map((page, sourcePageIndex) => {
    const mediaBox = readPdfBox(page.getMediaBox());
    const originalCropBox = readPdfBox(page.getCropBox());
    const visibleBox = computeVisibleBox(mediaBox, originalCropBox);

    return {
      id: createFileId(),
      sourcePageIndex,
      intrinsicRotation: normalizePageRotation(page.getRotation().angle),
      mediaBox,
      originalCropBox,
      visibleBox,
    };
  });

  return { pages, redactions: [] };
}

export function findPageBySourceIndex(
  pages: RedactionPageEntry[],
  sourcePageIndex: number,
): RedactionPageEntry | undefined {
  return pages.find((page) => page.sourcePageIndex === sourcePageIndex);
}

export function getRedactionsForPage(
  redactions: RedactionRect[],
  sourcePageIndex: number,
): RedactionRect[] {
  return redactions.filter((rect) => rect.pageIndex === sourcePageIndex);
}

export function getRedactedPageIndices(redactions: RedactionRect[]): Set<number> {
  return new Set(redactions.map((rect) => rect.pageIndex));
}

export function validateRedactionRect(rect: NormalizedRedactionRect): void {
  if (!validateNormalizedRedaction(rect)) {
    if (
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      !Number.isFinite(rect.width) ||
      !Number.isFinite(rect.height)
    ) {
      throw new RedactPdfError(
        "INVALID_RECTANGLE",
        "Redaction coordinates are invalid.",
      );
    }

    if (
      rect.width < 0.01 ||
      rect.height < 0.01 ||
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      throw new RedactPdfError(
        "INVALID_RECTANGLE",
        "Redaction area is too small. Increase the selection size.",
      );
    }

    throw new RedactPdfError(
      "INVALID_RECTANGLE",
      "Redaction selection is outside the allowed page bounds.",
    );
  }
}

export function addRedaction(
  state: RedactionDocumentState,
  pageIndex: number,
  normalizedRect: NormalizedRedactionRect,
): RedactionDocumentState {
  validateRedactionRect(normalizedRect);

  if (!findPageBySourceIndex(state.pages, pageIndex)) {
    throw new RedactPdfError(
      "INVALID_PAGE",
      `Page index ${pageIndex + 1} is not in this document.`,
    );
  }

  if (state.redactions.length >= MAX_REDACTIONS) {
    throw new RedactPdfError(
      "TOO_MANY_REDACTIONS",
      `This document exceeds the maximum of ${MAX_REDACTIONS} redaction marks.`,
    );
  }

  const redaction: RedactionRect = {
    id: createFileId(),
    pageIndex,
    x: normalizedRect.x,
    y: normalizedRect.y,
    width: normalizedRect.width,
    height: normalizedRect.height,
  };

  return {
    ...state,
    redactions: [...state.redactions, redaction],
  };
}

export function removeRedaction(
  state: RedactionDocumentState,
  redactionId: string,
): RedactionDocumentState {
  return {
    ...state,
    redactions: state.redactions.filter((rect) => rect.id !== redactionId),
  };
}

export function updateRedaction(
  state: RedactionDocumentState,
  redactionId: string,
  normalizedRect: NormalizedRedactionRect,
): RedactionDocumentState {
  validateRedactionRect(normalizedRect);

  return {
    ...state,
    redactions: state.redactions.map((rect) =>
      rect.id === redactionId
        ? {
            ...rect,
            x: normalizedRect.x,
            y: normalizedRect.y,
            width: normalizedRect.width,
            height: normalizedRect.height,
          }
        : rect,
    ),
  };
}

export function canExportRedactPdf(state: RedactionDocumentState): boolean {
  return state.redactions.length > 0;
}

export function validateExportRedactionState(state: RedactionDocumentState): void {
  if (!canExportRedactPdf(state)) {
    throw new RedactPdfError(
      "NO_REDACTIONS",
      "Add at least one redaction area before exporting.",
    );
  }

  const redactedPageCount = getRedactedPageIndices(state.redactions).size;
  if (redactedPageCount > MAX_REDACTED_PAGES_SOFT) {
    throw new RedactPdfError(
      "TOO_MANY_REDACTED_PAGES",
      `This export would rasterize ${redactedPageCount} pages. The soft limit is ${MAX_REDACTED_PAGES_SOFT}.`,
    );
  }

  for (const rect of state.redactions) {
    validateRedactionRect(rect);
  }
}

export function countRedactedPages(state: RedactionDocumentState): number {
  return getRedactedPageIndices(state.redactions).size;
}

export function countCleanPages(state: RedactionDocumentState): number {
  const redacted = getRedactedPageIndices(state.redactions);
  return state.pages.filter((page) => !redacted.has(page.sourcePageIndex)).length;
}
