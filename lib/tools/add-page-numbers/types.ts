/** Add Page Numbers PDF core types (Phase 122B). */

import type { PdfBox } from "@/lib/tools/crop-pdf/types";

export type PageNumberPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type PageNumberFormat =
  | "number"
  | "page-number"
  | "number-of-total"
  | "page-number-of-total";

export type PageNumberRotation = 0 | 90 | 180 | 270;

/** User-facing options before validation. */
export interface PageNumberOptions {
  /** When true, number every page (ignores pageRangeInput). */
  allPages: boolean;
  /** 1-based range expression, e.g. "1-5" or "1,3,5". Used when allPages is false. */
  pageRangeInput: string;
  startingNumber: number;
  format: PageNumberFormat;
  position: PageNumberPosition;
  fontSize: number;
  margin: number;
  /** Canonical 6-digit hex, e.g. #000000 */
  color: string;
}

/** Validated export-ready options. selectedPageIndices are 0-based, sorted, unique. */
export interface ValidatedPageNumberOptions {
  selectedPageIndices: number[];
  startingNumber: number;
  format: PageNumberFormat;
  position: PageNumberPosition;
  fontSize: number;
  margin: number;
  color: { r: number; g: number; b: number };
}

export interface PageNumberPageEntry {
  sourcePageIndex: number;
  intrinsicRotation: PageNumberRotation;
  mediaBox: PdfBox;
  cropBox: PdfBox;
  visibleBox: PdfBox;
}

export interface PageNumberDocumentState {
  pageCount: number;
  pages: PageNumberPageEntry[];
}

export type AddPageNumbersErrorCode =
  | "WRONG_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_PAGES"
  | "CORRUPT_PDF"
  | "PASSWORD_PDF"
  | "INVALID_PAGE_RANGE"
  | "EMPTY_SELECTION"
  | "INVALID_START_NUMBER"
  | "INVALID_FONT_SIZE"
  | "INVALID_MARGIN"
  | "INVALID_COLOR"
  | "TEXT_DOES_NOT_FIT"
  | "EXPORT_FAILED";

export class AddPageNumbersError extends Error {
  readonly code: AddPageNumbersErrorCode;

  constructor(code: AddPageNumbersErrorCode, message: string) {
    super(message);
    this.name = "AddPageNumbersError";
    this.code = code;
  }
}

export function getAddPageNumbersErrorMessage(error: unknown): string {
  if (error instanceof AddPageNumbersError) {
    return error.message;
  }

  return error instanceof Error
    ? error.message
    : "Could not add page numbers to this PDF. The file may be corrupt or unsupported.";
}

/** Client-side processing — no server upload. */
export const PAGE_NUMBERS_PRIVACY_COPY =
  "Your PDF is numbered locally in your browser and is not uploaded to Scanonix servers.";
