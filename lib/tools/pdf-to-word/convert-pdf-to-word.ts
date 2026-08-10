import { createWorker, type Worker } from "tesseract.js";
import { isPasswordProtectedPdfError } from "../compress-pdf/compression-levels";
import {
  loadPdfDocument,
  renderPdfPageToCanvasFromDoc,
} from "../pdf-to-image/pdf-render";
import { buildDocxFromPages } from "./build-docx";
import {
  extractNativePageContent,
  MIN_NATIVE_TEXT_CHARS,
  ocrTextToBlocks,
} from "./extract-pdf-page";
import type {
  PageContent,
  PdfToWordProgressCallback,
} from "./types";
import { PdfToWordError } from "./types";

const PDF_OCR_SCALE = 2;

async function ocrPageWithWorker(
  worker: Worker,
  canvas: HTMLCanvasElement,
): Promise<string> {
  const result = await worker.recognize(canvas);
  return result.data.text.trim();
}

export interface PdfToWordResult {
  blob: Blob;
  usedOcr: boolean;
}

export async function convertPdfToWord(
  pdfBytes: ArrayBuffer,
  onProgress?: PdfToWordProgressCallback,
): Promise<PdfToWordResult> {
  onProgress?.("reading");

  let pdf;

  try {
    pdf = await loadPdfDocument(pdfBytes);
  } catch (error) {
    if (isPasswordProtectedPdfError(error)) {
      throw new PdfToWordError(
        "PASSWORD",
        "This PDF is password-protected. Remove the password and try again.",
      );
    }

    throw new PdfToWordError(
      "CORRUPT",
      "Could not read this PDF. The file may be corrupt or unsupported.",
    );
  }

  const totalPages = pdf.numPages;

  if (totalPages === 0) {
    throw new PdfToWordError(
      "EMPTY",
      "This PDF contains no pages to convert.",
    );
  }

  onProgress?.("extracting");

  let ocrWorker: Worker | undefined;
  const pages: PageContent[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      onProgress?.("processing", { current: pageNumber, total: totalPages });

      const page = await pdf.getPage(pageNumber);
      const nativeContent = await extractNativePageContent(page);
      let blocks = nativeContent.blocks;
      let usedOcr = false;

      if (nativeContent.charCount < MIN_NATIVE_TEXT_CHARS) {
        if (!ocrWorker) {
          ocrWorker = await createWorker("eng");
        }

        const canvas = await renderPdfPageToCanvasFromDoc(
          pdf,
          pageNumber,
          PDF_OCR_SCALE,
        );
        const ocrText = await ocrPageWithWorker(ocrWorker, canvas);

        if (ocrText) {
          blocks = ocrTextToBlocks(ocrText);
          usedOcr = true;
        }
      }

      pages.push({
        pageNumber,
        blocks,
        usedOcr,
      });
    }
  } catch (error) {
    if (error instanceof PdfToWordError) {
      throw error;
    }

    throw new PdfToWordError(
      "FAILURE",
      "Failed while extracting text from this PDF.",
    );
  } finally {
    if (ocrWorker) {
      await ocrWorker.terminate();
    }
  }

  const hasContent = pages.some((page) =>
    page.blocks.some((block) => {
      switch (block.type) {
        case "heading":
        case "paragraph":
          return block.text.trim().length > 0;
        case "list":
          return block.items.some((item) => item.trim().length > 0);
      }
    }),
  );

  if (!hasContent) {
    throw new PdfToWordError(
      "EMPTY",
      "No readable text was found in this PDF. It may be empty or contain only images without OCR-friendly content.",
    );
  }

  onProgress?.("creating");

  const anyOcr = pages.some((page) => page.usedOcr);

  try {
    const blob = await buildDocxFromPages(pages);
    onProgress?.("complete");
    return { blob, usedOcr: anyOcr };
  } catch {
    throw new PdfToWordError(
      "FAILURE",
      "Could not create the Word document. Please try again.",
    );
  }
}
