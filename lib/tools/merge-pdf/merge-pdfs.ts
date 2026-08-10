import { PDFDocument } from "pdf-lib";
import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";

export async function mergePdfs(
  files: File[],
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  if (files.length < 2) {
    throw new Error("Add at least two PDFs to merge");
  }

  const mergedPdf = await PDFDocument.create();

  for (let index = 0; index < files.length; index++) {
    onProgress?.(index + 1, files.length);

    const bytes = await files[index].arrayBuffer();
    const sourcePdf = await loadPdfDocument(bytes);
    const copiedPages = await mergedPdf.copyPages(
      sourcePdf,
      sourcePdf.getPageIndices(),
    );

    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedBytes = await mergedPdf.save();
  return new Blob([new Uint8Array(mergedBytes)], { type: "application/pdf" });
}

export function getMergePdfErrorMessage(error: unknown): string {
  if (error instanceof PdfLoadError) {
    return error.message;
  }

  return error instanceof Error ? error.message : "Could not merge PDF files.";
}
