import { degrees, PDFDocument } from "pdf-lib";
import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import {
  getPdfRotateErrorMessage,
  PdfRotateError,
  type PdfRotationDegrees,
} from "./types";

export async function rotatePdfPages(
  pdfBytes: ArrayBuffer,
  pageNumbers: number[],
  rotation: PdfRotationDegrees,
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  if (pageNumbers.length === 0) {
    throw new PdfRotateError(
      "NO_PAGES_SELECTED",
      "Select at least one page to rotate.",
    );
  }

  let pdf: PDFDocument;

  try {
    pdf = await loadPdfDocument(pdfBytes);
  } catch (error) {
    if (error instanceof PdfLoadError) {
      throw new PdfRotateError(
        error.code === "PASSWORD" ? "PASSWORD_PDF" : "CORRUPT_PDF",
        error.message,
      );
    }
    throw new PdfRotateError(
      "CORRUPT_PDF",
      getPdfRotateErrorMessage(error),
    );
  }

  const totalPages = pdf.getPageCount();
  if (totalPages === 0) {
    throw new PdfRotateError("NO_PAGES", "This PDF contains no pages to rotate.");
  }

  const uniquePages = [...new Set(pageNumbers)].sort((a, b) => a - b);

  for (const pageNumber of uniquePages) {
    if (pageNumber < 1 || pageNumber > totalPages) {
      throw new PdfRotateError(
        "ROTATE_FAILED",
        `Page ${pageNumber} is outside the document range (1–${totalPages}).`,
      );
    }
  }

  try {
    uniquePages.forEach((pageNumber, index) => {
      onProgress?.(index + 1, uniquePages.length);
      const page = pdf.getPage(pageNumber - 1);
      const currentAngle = page.getRotation().angle;
      page.setRotation(degrees((currentAngle + rotation) % 360));
    });

    const outputBytes = await pdf.save();
    return new Blob([new Uint8Array(outputBytes)], { type: "application/pdf" });
  } catch (error) {
    if (error instanceof PdfLoadError) {
      throw new PdfRotateError(
        error.code === "PASSWORD" ? "PASSWORD_PDF" : "CORRUPT_PDF",
        error.message,
      );
    }
    throw new PdfRotateError(
      "ROTATE_FAILED",
      error instanceof Error ? error.message : "Failed to rotate PDF pages.",
    );
  }
}

export function buildRotatedPdfFilename(originalName: string): string {
  const baseName = originalName.replace(/\.pdf$/i, "") || "scanonix-document";
  return `${baseName}-rotated.pdf`;
}
