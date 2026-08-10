import { createWorker, type Worker } from "tesseract.js";
import { normalizeUploadedFileToCanvas } from "@/lib/image/convert-format";
import { getImageDimensions } from "../image-utils";
import {
  loadPdfDocument,
  renderPdfPageToCanvasFromDoc,
} from "../pdf-to-image/pdf-render";
import {
  type OcrLanguageCode,
  OcrExtractionError,
  type OcrProgressPhase,
} from "./languages";
import { assertSupportedOcrFile, isOcrPdfFile } from "./file-validation";
import { getOcrWorkerParameters, preprocessCanvasForOcr } from "./preprocess";

const PDF_OCR_SCALE = 2.5;

export type OcrProgressCallback = (
  phase: OcrProgressPhase,
  detail?: { current?: number; total?: number },
) => void;

function isPasswordProtectedPdfError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { name?: string; message?: string };
  return (
    maybeError.name === "PasswordException" ||
    /password/i.test(maybeError.message ?? "")
  );
}

async function validateImageFile(file: File): Promise<void> {
  try {
    const { width, height } = await getImageDimensions(file);
    if (width === 0 || height === 0) {
      throw new OcrExtractionError(
        "EMPTY_IMAGE",
        "This image appears to be empty or unreadable.",
      );
    }
  } catch (error) {
    if (error instanceof OcrExtractionError) {
      throw error;
    }
    throw new OcrExtractionError(
      "EMPTY_IMAGE",
      "Could not read this image. It may be empty or corrupted.",
    );
  }
}

async function createOcrWorker(language: OcrLanguageCode): Promise<Worker> {
  const worker = await createWorker(language);
  await worker.setParameters(getOcrWorkerParameters());
  return worker;
}

async function recognizeCanvas(
  worker: Worker,
  canvas: HTMLCanvasElement,
): Promise<string> {
  const prepared = preprocessCanvasForOcr(canvas);
  const result = await worker.recognize(prepared);
  return result.data.text.trim();
}

async function recognizeWithWorker(
  file: File,
  language: OcrLanguageCode,
  onProgress?: OcrProgressCallback,
): Promise<string> {
  onProgress?.("reading");

  let worker: Worker | undefined;

  try {
    await validateImageFile(file);
    const canvas = await normalizeUploadedFileToCanvas(file);
    worker = await createOcrWorker(language);
    const text = await recognizeCanvas(worker, canvas);

    if (!text) {
      throw new OcrExtractionError(
        "OCR_FAILURE",
        "No readable text was found in this file.",
      );
    }

    return text;
  } catch (error) {
    if (error instanceof OcrExtractionError) {
      throw error;
    }

    throw new OcrExtractionError(
      "OCR_FAILURE",
      "OCR failed to extract text. Try a clearer scan or photo.",
    );
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

async function extractTextFromPdf(
  file: File,
  language: OcrLanguageCode,
  onProgress?: OcrProgressCallback,
): Promise<string> {
  onProgress?.("preparing");

  let pdfBytes: ArrayBuffer;

  try {
    pdfBytes = await file.arrayBuffer();
  } catch {
    throw new OcrExtractionError(
      "OCR_FAILURE",
      "Could not read this PDF file.",
    );
  }

  let pdf;

  try {
    pdf = await loadPdfDocument(pdfBytes);
  } catch (error) {
    if (isPasswordProtectedPdfError(error)) {
      throw new OcrExtractionError(
        "PASSWORD_PDF",
        "This PDF is password-protected. Remove the password and try again.",
      );
    }

    throw new OcrExtractionError(
      "OCR_FAILURE",
      "Could not open this PDF for OCR processing.",
    );
  }

  const totalPages = pdf.numPages;

  if (totalPages === 0) {
    throw new OcrExtractionError(
      "OCR_FAILURE",
      "This PDF contains no pages to process.",
    );
  }

  onProgress?.("reading");

  let worker: Worker | undefined;

  try {
    worker = await createOcrWorker(language);
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      onProgress?.("processing", { current: pageNumber, total: totalPages });

      const canvas = await renderPdfPageToCanvasFromDoc(
        pdf,
        pageNumber,
        PDF_OCR_SCALE,
      );

      const pageText = await recognizeCanvas(worker, canvas);

      if (pageText) {
        pageTexts.push(
          totalPages > 1
            ? `--- Page ${pageNumber} ---\n${pageText}`
            : pageText,
        );
      }
    }

    if (pageTexts.length === 0) {
      throw new OcrExtractionError(
        "OCR_FAILURE",
        "No readable text was found in this PDF.",
      );
    }

    return pageTexts.join("\n\n");
  } catch (error) {
    if (error instanceof OcrExtractionError) {
      throw error;
    }

    throw new OcrExtractionError(
      "OCR_FAILURE",
      "OCR failed while processing this PDF.",
    );
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

export async function extractTextFromFile(
  file: File,
  language: OcrLanguageCode,
  onProgress?: OcrProgressCallback,
): Promise<string> {
  assertSupportedOcrFile(file);
  onProgress?.("preparing");

  if (isOcrPdfFile(file)) {
    const text = await extractTextFromPdf(file, language, onProgress);
    onProgress?.("complete");
    return text;
  }

  const text = await recognizeWithWorker(file, language, onProgress);
  onProgress?.("complete");
  return text;
}
