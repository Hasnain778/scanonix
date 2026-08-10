import { PDFDocument } from "pdf-lib";
import { assertPdfBytes } from "@/lib/image/validate-binary";
import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import {
  type CompressionLevel,
  COMPRESSION_LEVELS,
  type CompressProgressPhase,
  PdfCompressionError,
} from "./compression-levels";

export type CompressProgressCallback = (
  phase: CompressProgressPhase,
  detail?: { current?: number; total?: number },
) => void;

function stripDocumentMetadata(pdfDoc: PDFDocument): void {
  pdfDoc.setTitle("");
  pdfDoc.setAuthor("");
  pdfDoc.setSubject("");
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer("");
  pdfDoc.setCreator("");
  pdfDoc.setCreationDate(new Date(0));
  pdfDoc.setModificationDate(new Date(0));
}

export async function compressPdfBytes(
  pdfBytes: ArrayBuffer,
  level: CompressionLevel,
  onProgress?: CompressProgressCallback,
): Promise<Uint8Array> {
  onProgress?.("reading");

  const settings = COMPRESSION_LEVELS[level];
  let pdfDoc: PDFDocument;

  try {
    pdfDoc = await loadPdfDocument(pdfBytes);
  } catch (error) {
    if (error instanceof PdfLoadError) {
      throw new PdfCompressionError(
        error.code === "PASSWORD" ? "PASSWORD" : "CORRUPT",
        error.message,
      );
    }

    throw new PdfCompressionError(
      "CORRUPT",
      "Could not read this PDF. The file may be corrupt or unsupported.",
    );
  }

  const totalPages = pdfDoc.getPageCount();

  if (totalPages === 0) {
    throw new PdfCompressionError(
      "CORRUPT",
      "This PDF contains no pages to compress.",
    );
  }

  onProgress?.("compressing", { current: 1, total: 1 });

  if (settings.stripMetadata) {
    stripDocumentMetadata(pdfDoc);
  }

  onProgress?.("finalising");

  let compressedBytes: Uint8Array;

  try {
    compressedBytes = await pdfDoc.save({
      useObjectStreams: settings.useObjectStreams,
      addDefaultPage: false,
    });
  } catch {
    throw new PdfCompressionError(
      "FAILURE",
      "Compression failed while saving the optimized PDF.",
    );
  }

  if (compressedBytes.byteLength === 0) {
    throw new PdfCompressionError(
      "FAILURE",
      "Compression produced an empty file. Please try again.",
    );
  }

  try {
    assertPdfBytes(compressedBytes);
  } catch {
    throw new PdfCompressionError(
      "FAILURE",
      "Compression produced an invalid PDF file.",
    );
  }

  onProgress?.("complete");

  return compressedBytes;
}

export async function compressPdfFile(
  file: File,
  level: CompressionLevel,
  onProgress?: CompressProgressCallback,
): Promise<Blob> {
  let pdfBytes: ArrayBuffer;

  try {
    pdfBytes = await file.arrayBuffer();
  } catch {
    throw new PdfCompressionError(
      "CORRUPT",
      "Could not read this PDF file.",
    );
  }

  const compressed = await compressPdfBytes(pdfBytes, level, onProgress);
  return new Blob([new Uint8Array(compressed)], { type: "application/pdf" });
}
