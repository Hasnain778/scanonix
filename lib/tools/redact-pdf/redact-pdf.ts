import { PDFDocument } from "pdf-lib";
import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import { buildRedactedPdfFilename } from "./filename";
import {
  applyAcroFormRedactionPolicy,
  CLEAN_PAGE_ANNOTATION_POLICY,
  REDACTED_PAGE_ANNOTATION_POLICY,
} from "./acroform-policy";
import {
  countCleanPages,
  countRedactedPages,
  getRedactedPageIndices,
  getRedactionsForPage,
  validateExportRedactionState,
} from "./redaction-state";
import { rasterizeRedactedPage } from "./rasterize-page";
import type {
  NormalizedRedactionRect,
  RedactionDocumentState,
  RedactPdfExportResult,
} from "./types";
import { RedactPdfError } from "./types";

type PdfLibDocument = PDFDocument;

function toNormalizedRects(
  redactions: ReturnType<typeof getRedactionsForPage>,
): NormalizedRedactionRect[] {
  return redactions.map((rect) => ({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  }));
}

async function appendRasterizedRedactedPage(
  outputPdf: PdfLibDocument,
  originalBytes: ArrayBuffer,
  sourcePageIndex: number,
  rotation: number,
  redactions: NormalizedRedactionRect[],
): Promise<void> {
  const raster = await rasterizeRedactedPage({
    pdfBytes: originalBytes,
    pageIndex: sourcePageIndex,
    rotation,
    redactions,
  });

  const embedded = await outputPdf.embedPng(raster.imageBytes);
  const page = outputPdf.addPage([raster.pageWidthPt, raster.pageHeightPt]);
  page.drawImage(embedded, {
    x: 0,
    y: 0,
    width: raster.pageWidthPt,
    height: raster.pageHeightPt,
  });
}

/**
 * Export a securely redacted PDF using hybrid client-side rasterization.
 *
 * Clean pages: copied from source (vector preserved).
 * Redacted pages: PDF.js render → burn black boxes → PNG embed as sole content.
 */
export async function redactPdfDocument(
  originalBytes: ArrayBuffer,
  state: RedactionDocumentState,
  originalFilename = "document.pdf",
  onProgress?: (current: number, total: number) => void,
): Promise<RedactPdfExportResult> {
  validateExportRedactionState(state);

  let sourcePdf: PdfLibDocument;

  try {
    sourcePdf = await loadPdfDocument(originalBytes);
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

  const pageCount = sourcePdf.getPageCount();
  const redactedPageIndices = getRedactedPageIndices(state.redactions);

  for (const pageIndex of redactedPageIndices) {
    if (pageIndex < 0 || pageIndex >= pageCount) {
      throw new RedactPdfError(
        "INVALID_PAGE",
        `Redaction references page ${pageIndex + 1}, but the document has ${pageCount} page(s).`,
      );
    }
  }

  const outDoc = await PDFDocument.create();

  try {
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      onProgress?.(pageIndex + 1, pageCount);

      const pageEntry = state.pages.find(
        (entry) => entry.sourcePageIndex === pageIndex,
      );
      const rotation = pageEntry?.intrinsicRotation ?? 0;
      const pageRedactions = getRedactionsForPage(state.redactions, pageIndex);

      if (pageRedactions.length > 0) {
        await appendRasterizedRedactedPage(
          outDoc,
          originalBytes,
          pageIndex,
          rotation,
          toNormalizedRects(pageRedactions),
        );
      } else {
        const [copiedPage] = await outDoc.copyPages(sourcePdf, [pageIndex]);
        outDoc.addPage(copiedPage);
      }
    }

    await applyAcroFormRedactionPolicy(outDoc, redactedPageIndices);

    const bytes = await outDoc.save();

    return {
      bytes: new Uint8Array(bytes),
      filename: buildRedactedPdfFilename(originalFilename),
      redactedPageCount: countRedactedPages(state),
      cleanPageCount: countCleanPages(state),
    };
  } catch (error) {
    if (error instanceof RedactPdfError) {
      throw error;
    }

    throw new RedactPdfError(
      "EXPORT_FAILED",
      error instanceof Error ? error.message : "Failed to export redacted PDF.",
    );
  }
}
