/**
 * Client-side document → plain text for AI Document Summary upload mode.
 * Native PDF text only — no OCR. DOCX via mammoth.extractRawText. TXT via File.text().
 */

import { isPasswordProtectedPdfError } from "@/lib/tools/compress-pdf/compression-levels";
import { loadPdfDocument } from "@/lib/tools/pdf-to-image/pdf-render";
import {
  extractNativePageContent,
  MIN_NATIVE_TEXT_CHARS,
} from "@/lib/tools/pdf-to-word/extract-pdf-page";
import { blocksToPlainText } from "@/lib/tools/pdf-to-word/text-structure";
import { isAcceptedPdfFile } from "@/lib/tools/pdf-utils";

export const SUMMARY_OCR_TOOL_HREF = "/tools/ocr";

export const SUMMARY_UPLOAD_ACCEPT =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

export type SummaryDocumentKind = "pdf" | "docx" | "txt";

export class SummaryDocumentExtractError extends Error {
  readonly code:
    | "UNSUPPORTED"
    | "TOO_LARGE"
    | "EMPTY"
    | "NO_NATIVE_TEXT"
    | "PASSWORD"
    | "CORRUPT"
    | "FAILURE";

  constructor(
    code: SummaryDocumentExtractError["code"],
    message: string,
  ) {
    super(message);
    this.name = "SummaryDocumentExtractError";
    this.code = code;
  }
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const NO_NATIVE_TEXT_MESSAGE =
  "We couldn't find selectable text in this PDF. If it's a scanned document, use Scanonix OCR first.";

export function detectSummaryDocumentKind(file: File): SummaryDocumentKind | null {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (isAcceptedPdfFile(file) || name.endsWith(".pdf") || type === "application/pdf") {
    return "pdf";
  }

  if (name.endsWith(".docx") || type === DOCX_MIME) {
    return "docx";
  }

  if (name.endsWith(".txt") || type === "text/plain") {
    return "txt";
  }

  return null;
}

export function validateSummaryUploadFile(
  file: File,
  maxUploadBytes: number,
): SummaryDocumentExtractError | null {
  const kind = detectSummaryDocumentKind(file);
  if (!kind) {
    const lower = file.name.toLowerCase();
    if (
      /\.(jpe?g|png|webp)$/i.test(lower) ||
      file.type.startsWith("image/")
    ) {
      return new SummaryDocumentExtractError(
        "UNSUPPORTED",
        "Images aren't supported here. Convert scanned pages with Scanonix OCR first, then paste or upload the text.",
      );
    }

    return new SummaryDocumentExtractError(
      "UNSUPPORTED",
      "Unsupported file type. Upload a PDF, DOCX, or TXT file.",
    );
  }

  if (file.size <= 0) {
    return new SummaryDocumentExtractError(
      "EMPTY",
      "This file appears to be empty.",
    );
  }

  if (file.size > maxUploadBytes) {
    const maxMb = Math.round(maxUploadBytes / (1024 * 1024));
    return new SummaryDocumentExtractError(
      "TOO_LARGE",
      `File exceeds the ${maxMb}MB plan upload limit.`,
    );
  }

  return null;
}

export function formatSummaryDocumentKind(kind: SummaryDocumentKind): string {
  switch (kind) {
    case "pdf":
      return "PDF";
    case "docx":
      return "DOCX";
    case "txt":
      return "TXT";
  }
}

async function extractTxtText(file: File): Promise<string> {
  const text = await file.text();
  if (!text.trim()) {
    throw new SummaryDocumentExtractError(
      "EMPTY",
      "This TXT file has no text to summarise.",
    );
  }
  return text;
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  // Browser build accepts arrayBuffer; Node build accepts buffer (mammoth package browser field).
  const input =
    typeof window === "undefined"
      ? { buffer: Buffer.from(arrayBuffer) }
      : { arrayBuffer };
  const result = await mammoth.extractRawText(input);
  const text = (result.value ?? "").trim();

  if (!text) {
    throw new SummaryDocumentExtractError(
      "EMPTY",
      "We couldn't extract text from this DOCX file.",
    );
  }

  return result.value;
}

async function extractPdfNativeText(file: File): Promise<string> {
  let pdf;

  try {
    const pdfBytes = await file.arrayBuffer();
    pdf = await loadPdfDocument(pdfBytes);
  } catch (error) {
    if (isPasswordProtectedPdfError(error)) {
      throw new SummaryDocumentExtractError(
        "PASSWORD",
        "This PDF is password-protected. Remove the password and try again.",
      );
    }

    throw new SummaryDocumentExtractError(
      "CORRUPT",
      "Could not read this PDF. The file may be corrupt or unsupported.",
    );
  }

  const totalPages = pdf.numPages;
  if (totalPages === 0) {
    throw new SummaryDocumentExtractError(
      "EMPTY",
      "This PDF contains no pages.",
    );
  }

  const pageTexts: string[] = [];
  let totalCharCount = 0;

  try {
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const nativeContent = await extractNativePageContent(page);
      totalCharCount += nativeContent.charCount;
      const plain = blocksToPlainText(nativeContent.blocks);
      if (plain) {
        pageTexts.push(plain);
      }
    }
  } catch (error) {
    if (error instanceof SummaryDocumentExtractError) {
      throw error;
    }

    throw new SummaryDocumentExtractError(
      "FAILURE",
      "Failed while extracting text from this PDF.",
    );
  }

  if (totalCharCount < MIN_NATIVE_TEXT_CHARS || pageTexts.length === 0) {
    throw new SummaryDocumentExtractError(
      "NO_NATIVE_TEXT",
      NO_NATIVE_TEXT_MESSAGE,
    );
  }

  return pageTexts.join("\n\n");
}

/**
 * Extract plain text from a Summary V1 upload. Does not call AI or consume usage.
 */
export async function extractSummaryDocumentText(file: File): Promise<{
  kind: SummaryDocumentKind;
  text: string;
}> {
  const kind = detectSummaryDocumentKind(file);
  if (!kind) {
    throw (
      validateSummaryUploadFile(file, Number.MAX_SAFE_INTEGER) ??
      new SummaryDocumentExtractError(
        "UNSUPPORTED",
        "Unsupported file type. Upload a PDF, DOCX, or TXT file.",
      )
    );
  }

  switch (kind) {
    case "txt":
      return { kind, text: await extractTxtText(file) };
    case "docx":
      return { kind, text: await extractDocxText(file) };
    case "pdf":
      return { kind, text: await extractPdfNativeText(file) };
  }
}
