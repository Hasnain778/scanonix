/** Watermark PDF core types (Phase 124B). */

import type { PdfBox } from "@/lib/tools/crop-pdf/types";

export type WatermarkType = "text" | "image";

export type WatermarkPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type WatermarkPageRotation = 0 | 90 | 180 | 270;

/** User-facing text watermark options before validation. */
export interface TextWatermarkOptions {
  type: "text";
  text: string;
  position: WatermarkPosition;
  opacity: number;
  fontSize: number;
  bold: boolean;
  /** Canonical 6-digit hex, e.g. #808080 */
  color: string;
  margin: number;
  /** Additional rotation in degrees (e.g. -45 for center diagonal). */
  rotationDegrees: number;
  allPages: boolean;
  pageRangeInput: string;
}

/** User-facing image watermark options before validation. */
export interface ImageWatermarkOptions {
  type: "image";
  imageBytes: Uint8Array;
  position: WatermarkPosition;
  opacity: number;
  /** Fraction of visible page width, e.g. 0.2 = 20%. */
  relativeWidthRatio: number;
  margin: number;
  rotationDegrees: number;
  allPages: boolean;
  pageRangeInput: string;
}

export type WatermarkPdfOptions = TextWatermarkOptions | ImageWatermarkOptions;

export interface ValidatedTextWatermarkOptions {
  type: "text";
  text: string;
  position: WatermarkPosition;
  opacity: number;
  fontSize: number;
  bold: boolean;
  color: { r: number; g: number; b: number };
  margin: number;
  rotationDegrees: number;
  selectedPageIndices: number[];
}

export interface ValidatedImageWatermarkOptions {
  type: "image";
  imageBytes: Uint8Array;
  position: WatermarkPosition;
  opacity: number;
  relativeWidthRatio: number;
  margin: number;
  rotationDegrees: number;
  selectedPageIndices: number[];
}

export type ValidatedWatermarkPdfOptions =
  | ValidatedTextWatermarkOptions
  | ValidatedImageWatermarkOptions;

export interface WatermarkPageEntry {
  sourcePageIndex: number;
  intrinsicRotation: WatermarkPageRotation;
  mediaBox: PdfBox;
  cropBox: PdfBox;
  visibleBox: PdfBox;
}

export interface WatermarkDocumentState {
  pageCount: number;
  pages: WatermarkPageEntry[];
  hasExistingDigitalSignatures: boolean;
}

export interface WatermarkPdfExportResult {
  bytes: Uint8Array;
  filename: string;
  hasExistingDigitalSignatures: boolean;
}

export type WatermarkPdfErrorCode =
  | "WRONG_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_PAGES"
  | "CORRUPT_PDF"
  | "PASSWORD_PDF"
  | "INVALID_PAGE_RANGE"
  | "EMPTY_SELECTION"
  | "MISSING_WATERMARK"
  | "INVALID_TEXT"
  | "TEXT_TOO_LONG"
  | "UNSUPPORTED_CHARACTERS"
  | "INVALID_FONT_SIZE"
  | "INVALID_MARGIN"
  | "INVALID_COLOR"
  | "INVALID_OPACITY"
  | "INVALID_ROTATION"
  | "INVALID_IMAGE"
  | "IMAGE_TOO_LARGE"
  | "IMAGE_TOO_BIG"
  | "INVALID_SCALE"
  | "TEXT_DOES_NOT_FIT"
  | "EXPORT_FAILED";

export class WatermarkPdfError extends Error {
  readonly code: WatermarkPdfErrorCode;

  constructor(code: WatermarkPdfErrorCode, message: string) {
    super(message);
    this.name = "WatermarkPdfError";
    this.code = code;
  }
}

export function getWatermarkPdfErrorMessage(error: unknown): string {
  if (error instanceof WatermarkPdfError) {
    return error.message;
  }

  return error instanceof Error
    ? error.message
    : "Could not watermark this PDF. The file may be corrupt or unsupported.";
}

/** Client-side processing — no server upload. */
export const WATERMARK_PDF_PRIVACY_COPY =
  "Your PDF is watermarked locally in your browser and is not uploaded to Scanonix servers.";

export const DIGITAL_SIGNATURE_WATERMARK_WARNING =
  "This PDF contains existing digital signatures. Adding a watermark and re-saving may invalidate them.";
