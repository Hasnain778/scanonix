import { degrees, PDFDocument } from "pdf-lib";
import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import { canExportOrganizePdf } from "./page-state";
import { getEffectiveRotation } from "./rotation";
import type { OrganizeDocumentState, OrganizePageEntry } from "./types";
import { OrganizePdfError } from "./types";

function validateExportState(pages: OrganizePageEntry[]): void {
  if (!canExportOrganizePdf({ pages })) {
    throw new OrganizePdfError(
      "NO_PAGES",
      "Add at least one page before exporting.",
    );
  }
}

/**
 * Export an organized PDF from source bytes and the current page state.
 *
 * Export order:
 * 1. For each entry in `pages` (UI order), copy source page by sourcePageIndex.
 * 2. Apply final rotation metadata on the copied page (intrinsic + delta).
 * 3. Append to output document.
 *
 * Uses vector copyPages — no rasterization.
 */
export async function organizePdfDocument(
  pdfBytes: ArrayBuffer,
  pages: OrganizePageEntry[],
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  validateExportState(pages);

  let sourcePdf;

  try {
    sourcePdf = await loadPdfDocument(pdfBytes);
  } catch (error) {
    if (error instanceof PdfLoadError) {
      throw new OrganizePdfError(
        error.code === "PASSWORD" ? "PASSWORD_PDF" : "CORRUPT_PDF",
        error.message,
      );
    }

    throw new OrganizePdfError(
      "CORRUPT_PDF",
      error instanceof Error ? error.message : "Could not read this PDF.",
    );
  }

  const sourcePageCount = sourcePdf.getPageCount();
  for (const entry of pages) {
    if (entry.sourcePageIndex < 0 || entry.sourcePageIndex >= sourcePageCount) {
      throw new OrganizePdfError(
        "INVALID_INDEX",
        `Page references source index ${entry.sourcePageIndex + 1}, but the document has ${sourcePageCount} page(s).`,
      );
    }
  }

  try {
    const outputPdf = await PDFDocument.create();

    for (let index = 0; index < pages.length; index += 1) {
      onProgress?.(index + 1, pages.length);

      const entry = pages[index];
      const [copiedPage] = await outputPdf.copyPages(sourcePdf, [
        entry.sourcePageIndex,
      ]);

      const finalRotation = getEffectiveRotation(
        entry.intrinsicRotation,
        entry.rotationDelta,
      );
      copiedPage.setRotation(degrees(finalRotation));
      outputPdf.addPage(copiedPage);
    }

    const outputBytes = await outputPdf.save();
    return new Blob([new Uint8Array(outputBytes)], { type: "application/pdf" });
  } catch (error) {
    if (error instanceof OrganizePdfError) {
      throw error;
    }

    throw new OrganizePdfError(
      "EXPORT_FAILED",
      error instanceof Error ? error.message : "Failed to export organized PDF.",
    );
  }
}

export async function organizePdfFromState(
  pdfBytes: ArrayBuffer,
  state: OrganizeDocumentState,
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  return organizePdfDocument(pdfBytes, state.pages, onProgress);
}

export { buildOrganizedPdfFilename } from "./filename";
