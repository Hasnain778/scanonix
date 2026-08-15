/** Redact PDF core types — normalized visual redaction coordinates (Phase 125B). */

import type { CropPageRotation, PdfBox } from "@/lib/tools/crop-pdf/types";

/**
 * Normalized redaction rectangle relative to the page's **visible** area (CropBox ∩ MediaBox).
 *
 * Values are fractions of visible width/height (0–1), top-left origin.
 * Preview-size independent — UI converts DOM pixels → normalized immediately.
 */
export interface NormalizedRedactionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One redaction mark in the working document.
 * Identity is always `id`, never array index.
 */
export interface RedactionRect {
  id: string;
  /** 0-based index in the uploaded source PDF. */
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RedactionPageEntry {
  /** Stable UUID — never derived from array index. */
  id: string;
  /** 0-based index in the uploaded source PDF (immutable after load). */
  sourcePageIndex: number;
  intrinsicRotation: CropPageRotation;
  mediaBox: PdfBox;
  originalCropBox: PdfBox;
  visibleBox: PdfBox;
}

export interface RedactionDocumentState {
  pages: RedactionPageEntry[];
  redactions: RedactionRect[];
}

export type RedactPdfErrorCode =
  | "FILE_TOO_LARGE"
  | "TOO_MANY_PAGES"
  | "TOO_MANY_REDACTED_PAGES"
  | "TOO_MANY_REDACTIONS"
  | "CORRUPT_PDF"
  | "PASSWORD_PDF"
  | "NO_REDACTIONS"
  | "INVALID_RECTANGLE"
  | "INVALID_PAGE"
  | "MEMORY_LIMIT"
  | "RASTERIZATION_FAILED"
  | "EXPORT_FAILED";

export class RedactPdfError extends Error {
  readonly code: RedactPdfErrorCode;

  constructor(code: RedactPdfErrorCode, message: string) {
    super(message);
    this.name = "RedactPdfError";
    this.code = code;
  }
}

export function getRedactPdfErrorMessage(error: unknown): string {
  if (error instanceof RedactPdfError) {
    return error.message;
  }

  return error instanceof Error
    ? error.message
    : "Could not redact this PDF. The file may be corrupt or unsupported.";
}

/** Secure redaction permanently destroys content in marked regions. */
export const REDACT_PERMANENT_WARNING =
  "Redactions permanently destroy content in the exported PDF. This cannot be undone.";

/** Client-side processing — no server upload for redaction. */
export const REDACT_PRIVACY_COPY =
  "Your PDF is redacted locally in your browser and is not uploaded to Scanonix servers for redaction processing.";

export interface RedactPdfExportResult {
  bytes: Uint8Array;
  filename: string;
  redactedPageCount: number;
  cleanPageCount: number;
}
