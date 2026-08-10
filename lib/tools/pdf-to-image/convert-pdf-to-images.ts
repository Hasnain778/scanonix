import { downloadOutputs } from "../download";
import { formatImagePageFilename } from "../split-pdf/page-ranges";
import type {
  ImageOutput,
  PdfToImageOptions,
} from "../types";
import {
  canvasToImageBlob,
  getRenderScale,
  loadPdfDocument,
  renderPdfPageToCanvasFromDoc,
} from "./pdf-render";

export async function convertPdfPagesToImages(
  pdfBytes: ArrayBuffer,
  pages: number[],
  options: PdfToImageOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<ImageOutput[]> {
  if (pages.length === 0) {
    throw new Error("Select at least one page to convert");
  }

  const pdf = await loadPdfDocument(pdfBytes);
  const totalPages = pdf.numPages;
  const renderScale = getRenderScale(options.scale);
  const outputs: ImageOutput[] = [];

  for (let index = 0; index < pages.length; index++) {
    const pageNumber = pages[index];
    onProgress?.(index + 1, pages.length);

    if (pageNumber < 1 || pageNumber > totalPages) {
      throw new Error(
        `Page ${pageNumber} is outside the document range (1–${totalPages})`,
      );
    }

    const canvas = await renderPdfPageToCanvasFromDoc(
      pdf,
      pageNumber,
      renderScale,
    );

    const blob = await canvasToImageBlob(
      canvas,
      options.format,
      options.quality,
    );

    outputs.push({
      filename: formatImagePageFilename(pageNumber, options.format),
      blob,
    });
  }

  return outputs;
}

export async function downloadImageOutputs(outputs: ImageOutput[]): Promise<void> {
  await downloadOutputs(outputs, "scanonix-pdf-images.zip");
}
