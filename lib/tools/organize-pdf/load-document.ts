import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import { createFileId } from "@/lib/utils/format";
import { MAX_ORGANIZE_PDF_BYTES, MAX_ORGANIZE_PDF_PAGES } from "./limits";
import { normalizePageRotation } from "./rotation";
import type { OrganizeDocumentState, OrganizePageEntry } from "./types";
import { OrganizePdfError } from "./types";

export interface LoadOrganizeDocumentOptions {
  /** When provided, reject PDFs larger than MAX_ORGANIZE_PDF_BYTES. */
  byteLength?: number;
}

export async function loadOrganizeDocumentState(
  pdfBytes: ArrayBuffer,
  options: LoadOrganizeDocumentOptions = {},
): Promise<OrganizeDocumentState> {
  if (
    options.byteLength !== undefined &&
    options.byteLength > MAX_ORGANIZE_PDF_BYTES
  ) {
    throw new OrganizePdfError(
      "FILE_TOO_LARGE",
      `This PDF exceeds the ${Math.round(MAX_ORGANIZE_PDF_BYTES / (1024 * 1024))}MB size limit.`,
    );
  }

  if (pdfBytes.byteLength > MAX_ORGANIZE_PDF_BYTES) {
    throw new OrganizePdfError(
      "FILE_TOO_LARGE",
      `This PDF exceeds the ${Math.round(MAX_ORGANIZE_PDF_BYTES / (1024 * 1024))}MB size limit.`,
    );
  }

  let pdf;

  try {
    pdf = await loadPdfDocument(pdfBytes);
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

  const pageCount = pdf.getPageCount();
  if (pageCount === 0) {
    throw new OrganizePdfError("NO_PAGES", "This PDF contains no pages to organize.");
  }

  if (pageCount > MAX_ORGANIZE_PDF_PAGES) {
    throw new OrganizePdfError(
      "TOO_MANY_PAGES",
      `This PDF has ${pageCount} pages. The maximum supported is ${MAX_ORGANIZE_PDF_PAGES}.`,
    );
  }

  const pages: OrganizePageEntry[] = pdf.getPages().map((page, sourcePageIndex) => {
    const { width, height } = page.getSize();
    return {
      id: createFileId(),
      sourcePageIndex,
      intrinsicRotation: normalizePageRotation(page.getRotation().angle),
      rotationDelta: 0,
      mediaWidth: width,
      mediaHeight: height,
    };
  });

  return { pages };
}
