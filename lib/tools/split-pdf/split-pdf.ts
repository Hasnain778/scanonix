import { PDFDocument } from "pdf-lib";
import { loadPdfDocument } from "@/lib/pdf/core";
import { downloadOutputs } from "../download";
import type { SplitOutput } from "../types";
import { formatPageFilename, toZeroBasedIndices } from "./page-ranges";

export async function extractPdfGroups(
  pdfBytes: ArrayBuffer,
  pageGroups: number[][],
  onProgress?: (current: number, total: number) => void,
): Promise<SplitOutput[]> {
  if (pageGroups.length === 0) {
    throw new Error("No pages selected for extraction");
  }

  const sourcePdf = await loadPdfDocument(pdfBytes);
  const totalPages = sourcePdf.getPageCount();
  const outputs: SplitOutput[] = [];

  for (let index = 0; index < pageGroups.length; index++) {
    onProgress?.(index + 1, pageGroups.length);

    const oneBasedPages = pageGroups[index];
    const zeroBasedIndices = toZeroBasedIndices(oneBasedPages);

    for (const pageIndex of zeroBasedIndices) {
      if (pageIndex < 0 || pageIndex >= totalPages) {
        throw new Error(
          `Page ${pageIndex + 1} is outside the document range (1–${totalPages})`,
        );
      }
    }

    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(sourcePdf, zeroBasedIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));

    const bytes = await newPdf.save();
    outputs.push({
      filename: formatPageFilename(oneBasedPages),
      blob: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    });
  }

  return outputs;
}

export async function downloadSplitOutputs(outputs: SplitOutput[]): Promise<void> {
  await downloadOutputs(outputs, "scanonix-split-files.zip");
}
