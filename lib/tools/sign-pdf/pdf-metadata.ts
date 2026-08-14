import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import { createPageGeometry } from "./coordinates";
import type { PageGeometry } from "./types";
import { MAX_SIGN_PDF_PAGES } from "./limits";
import { SignPdfError } from "./types";

export interface SignPdfDocumentMetadata {
  pageCount: number;
  pageGeometries: PageGeometry[];
}

export async function loadSignPdfDocumentMetadata(
  pdfBytes: ArrayBuffer,
): Promise<SignPdfDocumentMetadata> {
  let pdf;

  try {
    pdf = await loadPdfDocument(pdfBytes);
  } catch (error) {
    if (error instanceof PdfLoadError) {
      throw new SignPdfError(
        error.code === "PASSWORD" ? "PASSWORD_PDF" : "CORRUPT_PDF",
        error.message,
      );
    }

    throw new SignPdfError(
      "CORRUPT_PDF",
      error instanceof Error ? error.message : "Could not read this PDF.",
    );
  }

  const pageCount = pdf.getPageCount();
  if (pageCount === 0) {
    throw new SignPdfError("NO_PAGES", "This PDF contains no pages to sign.");
  }

  if (pageCount > MAX_SIGN_PDF_PAGES) {
    throw new SignPdfError(
      "INVALID_PLACEMENT",
      `This PDF has ${pageCount} pages. The maximum supported for signing is ${MAX_SIGN_PDF_PAGES}.`,
    );
  }

  const pageGeometries = pdf.getPages().map((page) => {
    const { width, height } = page.getSize();
    return createPageGeometry(width, height, page.getRotation().angle);
  });

  return { pageCount, pageGeometries };
}

export async function getSignatureAssetAspectRatio(
  bytes: Uint8Array,
  mimeType: "image/png" | "image/jpeg",
): Promise<number> {
  if (typeof document === "undefined") {
    return 2.5;
  }

  const blob = new Blob([Uint8Array.from(bytes)], { type: mimeType });
  const url = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not read signature image."));
      element.src = url;
    });

    if (image.naturalHeight === 0) {
      return 2.5;
    }

    return image.naturalWidth / image.naturalHeight;
  } finally {
    URL.revokeObjectURL(url);
  }
}
