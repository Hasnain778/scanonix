/** Workspace UI helpers for Watermark PDF client (Phase 124C). */

import {
  DEFAULT_RELATIVE_WIDTH_RATIO,
  DEFAULT_WATERMARK_COLOR,
  DEFAULT_WATERMARK_FONT_SIZE,
  DEFAULT_WATERMARK_MARGIN,
  DEFAULT_WATERMARK_OPACITY,
  DEFAULT_CENTER_DIAGONAL_ROTATION,
  MAX_RELATIVE_WIDTH_RATIO,
  MAX_WATERMARK_FONT_SIZE,
  MAX_WATERMARK_OPACITY,
  MAX_WATERMARK_ROTATION,
  MIN_RELATIVE_WIDTH_RATIO,
  MIN_WATERMARK_FONT_SIZE,
  MIN_WATERMARK_OPACITY,
  MIN_WATERMARK_ROTATION,
  WATERMARK_MARGIN_LARGE,
  WATERMARK_MARGIN_MEDIUM,
  WATERMARK_MARGIN_SMALL,
} from "./limits";
import { resolvePageSelection } from "./page-range";
import {
  DIGITAL_SIGNATURE_WATERMARK_WARNING,
  WATERMARK_PDF_PRIVACY_COPY,
  type ImageWatermarkOptions,
  type TextWatermarkOptions,
  type WatermarkPdfOptions,
  type WatermarkPosition,
  type WatermarkType,
} from "./types";
import { WatermarkPdfError, type WatermarkPdfErrorCode } from "./types";
import {
  containsUnsupportedWinAnsiCharacters,
  findUnsupportedWinAnsiCharacters,
  validateHexColor,
  validateWatermarkText,
} from "./validation";
import { buildWatermarkedPdfFilename } from "./filename";
import { watermarkPdfDocument } from "./watermark-pdf";

export const WATERMARK_UI_PRIVACY_COPY = WATERMARK_PDF_PRIVACY_COPY;

export const WATERMARK_SECURITY_COPY =
  "A watermark does not encrypt or prevent editing of the PDF.";

export { DIGITAL_SIGNATURE_WATERMARK_WARNING };

export const MARGIN_PRESET_OPTIONS = [
  { label: "Small", value: WATERMARK_MARGIN_SMALL },
  { label: "Medium", value: WATERMARK_MARGIN_MEDIUM },
  { label: "Large", value: WATERMARK_MARGIN_LARGE },
] as const;

export type MarginPresetValue = (typeof MARGIN_PRESET_OPTIONS)[number]["value"];

export const ROTATION_PRESET_OPTIONS = [
  { label: "-45°", value: -45 },
  { label: "0°", value: 0 },
  { label: "45°", value: 45 },
  { label: "90°", value: 90 },
] as const;

export const WATERMARK_PREVIEW_MAX_CSS_WIDTH = 920;
export const WATERMARK_PREVIEW_MIN_CSS_WIDTH = 280;

/** Preview column width for PDF.js render plan (document-first editor). */
export function computeWatermarkEditorContainerWidth(clientWidth: number): number {
  return Math.min(
    WATERMARK_PREVIEW_MAX_CSS_WIDTH,
    Math.max(WATERMARK_PREVIEW_MIN_CSS_WIDTH, clientWidth - 32),
  );
}

export const POSITION_GRID: WatermarkPosition[][] = [
  ["top-left", "top-center", "top-right"],
  ["center", "center", "center"],
  ["bottom-left", "bottom-center", "bottom-right"],
];

export const WATERMARK_POSITIONS: WatermarkPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "center",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export const MIN_OPACITY_PERCENT = 10;
export const MAX_OPACITY_PERCENT = 100;
export const MIN_RELATIVE_WIDTH_PERCENT = MIN_RELATIVE_WIDTH_RATIO * 100;
export const MAX_RELATIVE_WIDTH_PERCENT = MAX_RELATIVE_WIDTH_RATIO * 100;

export interface WatermarkWorkspaceSettings {
  mode: WatermarkType;
  text: string;
  position: WatermarkPosition;
  opacityPercent: number;
  fontSize: number;
  bold: boolean;
  color: string;
  margin: number;
  rotationDegrees: number;
  allPages: boolean;
  pageRangeInput: string;
  relativeWidthPercent: number;
}

export interface ImageWorkspaceAsset {
  bytes: Uint8Array;
  previewUrl: string;
  fileName: string;
  mimeType: "image/png" | "image/jpeg";
  intrinsicWidth: number;
  intrinsicHeight: number;
  isTransparentPng: boolean;
}

export interface PreviewWatermarkResult {
  isWatermarked: boolean;
  selectionError?: string;
  selectedPages: number[];
  selectedZeroBasedIndices: number[];
}

export function opacityPercentToEngine(percent: number): number {
  const clamped = Math.min(MAX_OPACITY_PERCENT, Math.max(MIN_OPACITY_PERCENT, percent));
  return Math.round(clamped) / 100;
}

export function opacityEngineToPercent(opacity: number): number {
  return Math.round(opacity * 100);
}

export function relativeWidthPercentToRatio(percent: number): number {
  const clamped = Math.min(
    MAX_RELATIVE_WIDTH_PERCENT,
    Math.max(MIN_RELATIVE_WIDTH_PERCENT, percent),
  );
  return clamped / 100;
}

export function relativeWidthRatioToPercent(ratio: number): number {
  return Math.round(ratio * 100);
}

export function createDefaultWorkspaceSettings(): WatermarkWorkspaceSettings {
  return {
    mode: "text",
    text: "CONFIDENTIAL",
    position: "center",
    opacityPercent: opacityEngineToPercent(DEFAULT_WATERMARK_OPACITY),
    fontSize: DEFAULT_WATERMARK_FONT_SIZE,
    bold: false,
    color: DEFAULT_WATERMARK_COLOR,
    margin: DEFAULT_WATERMARK_MARGIN,
    rotationDegrees: DEFAULT_CENTER_DIAGONAL_ROTATION,
    allPages: true,
    pageRangeInput: "",
    relativeWidthPercent: relativeWidthRatioToPercent(DEFAULT_RELATIVE_WIDTH_RATIO),
  };
}

export function switchWatermarkMode(
  current: WatermarkWorkspaceSettings,
  mode: WatermarkType,
): WatermarkWorkspaceSettings {
  if (current.mode === mode) {
    return current;
  }

  return {
    ...current,
    mode,
    rotationDegrees: mode === "text" ? DEFAULT_CENTER_DIAGONAL_ROTATION : 0,
  };
}

export function resetWorkspaceSettings(): WatermarkWorkspaceSettings {
  return createDefaultWorkspaceSettings();
}

export function getPositionLabel(position: WatermarkPosition): string {
  if (position === "center") {
    return "center";
  }

  const [vertical, horizontal] = position.split("-") as [string, string];
  return `${vertical} ${horizontal}`;
}

export function getTextValidationError(text: string): string | undefined {
  try {
    validateWatermarkText(text);
    return undefined;
  } catch (error) {
    if (error instanceof WatermarkPdfError) {
      return error.message;
    }
    return "Invalid watermark text.";
  }
}

export function getUnsupportedCharacterError(text: string): string | undefined {
  if (!text.trim()) {
    return undefined;
  }

  const unsupported = findUnsupportedWinAnsiCharacters(text);
  if (unsupported.length === 0) {
    return undefined;
  }

  return `Watermark text contains characters that cannot be exported with standard PDF fonts: ${unsupported.join("")}`;
}

export function canUseBoldInWorkspace(text: string, boldRequested: boolean): boolean {
  return boldRequested && !containsUnsupportedWinAnsiCharacters(text.trim());
}

export function resolvePreviewWatermark(
  allPages: boolean,
  pageRangeInput: string,
  totalPages: number,
  previewPageIndex: number,
): PreviewWatermarkResult {
  const selection = resolvePageSelection(allPages, pageRangeInput, totalPages);

  if (selection.error) {
    return {
      isWatermarked: false,
      selectionError: selection.error,
      selectedPages: [],
      selectedZeroBasedIndices: [],
    };
  }

  const selectedZeroBasedIndices = selection.pages.map((page) => page - 1);
  const isWatermarked = selectedZeroBasedIndices.includes(previewPageIndex);

  return {
    isWatermarked,
    selectedPages: selection.pages,
    selectedZeroBasedIndices,
  };
}

export function canExportWatermarkWorkspace(
  pageCount: number,
  isExporting: boolean,
  selectionError: string | undefined,
  selectedCount: number,
  mode: WatermarkType,
  textError: string | undefined,
  hasImage: boolean,
): boolean {
  if (pageCount <= 0 || isExporting || selectionError || selectedCount <= 0) {
    return false;
  }

  if (mode === "text") {
    return !textError;
  }

  return hasImage;
}

export function buildTextWatermarkExportOptions(
  settings: WatermarkWorkspaceSettings,
): TextWatermarkOptions {
  return {
    type: "text",
    text: settings.text,
    position: settings.position,
    opacity: opacityPercentToEngine(settings.opacityPercent),
    fontSize: settings.fontSize,
    bold: settings.bold,
    color: settings.color,
    margin: settings.margin,
    rotationDegrees: settings.rotationDegrees,
    allPages: settings.allPages,
    pageRangeInput: settings.pageRangeInput,
  };
}

export function buildImageWatermarkExportOptions(
  settings: WatermarkWorkspaceSettings,
  imageBytes: Uint8Array,
): ImageWatermarkOptions {
  return {
    type: "image",
    imageBytes,
    position: settings.position,
    opacity: opacityPercentToEngine(settings.opacityPercent),
    relativeWidthRatio: relativeWidthPercentToRatio(settings.relativeWidthPercent),
    margin: settings.margin,
    rotationDegrees: settings.rotationDegrees,
    allPages: settings.allPages,
    pageRangeInput: settings.pageRangeInput,
  };
}

export function buildWatermarkExportOptions(
  settings: WatermarkWorkspaceSettings,
  imageBytes: Uint8Array | null,
): WatermarkPdfOptions {
  if (settings.mode === "image") {
    if (!imageBytes) {
      throw new WatermarkPdfError(
        "INVALID_IMAGE",
        "Choose a PNG or JPEG image for the watermark.",
      );
    }

    return buildImageWatermarkExportOptions(settings, imageBytes);
  }

  return buildTextWatermarkExportOptions(settings);
}

export function validateRotationInput(rotationDegrees: number): number | undefined {
  if (!Number.isFinite(rotationDegrees)) {
    return undefined;
  }

  if (rotationDegrees < MIN_WATERMARK_ROTATION || rotationDegrees > MAX_WATERMARK_ROTATION) {
    return undefined;
  }

  return rotationDegrees;
}

export function clampFontSize(fontSize: number): number {
  return Math.min(
    MAX_WATERMARK_FONT_SIZE,
    Math.max(MIN_WATERMARK_FONT_SIZE, Math.round(fontSize)),
  );
}

export function validateWorkspaceColor(color: string): string | undefined {
  try {
    validateHexColor(color);
    return undefined;
  } catch (error) {
    if (error instanceof WatermarkPdfError) {
      return error.message;
    }
    return "Enter a valid hex color.";
  }
}

export function mapEngineErrorToMessage(
  code: WatermarkPdfErrorCode,
  fallbackMessage: string,
): string {
  switch (code) {
    case "WRONG_FILE_TYPE":
      return "Please upload a PDF file.";
    case "FILE_TOO_LARGE":
      return fallbackMessage;
    case "TOO_MANY_PAGES":
      return fallbackMessage;
    case "CORRUPT_PDF":
      return fallbackMessage;
    case "PASSWORD_PDF":
      return "This PDF is password-protected. Remove the password and try again.";
    case "INVALID_PAGE_RANGE":
    case "EMPTY_SELECTION":
      return fallbackMessage;
    case "UNSUPPORTED_CHARACTERS":
    case "INVALID_TEXT":
    case "TEXT_TOO_LONG":
      return fallbackMessage;
    default:
      return fallbackMessage;
  }
}

export function sanitizeUserFacingError(message: string | undefined): string | undefined {
  if (!message) {
    return undefined;
  }

  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Detect PNG with alpha channel for preview state (test T). */
export function isTransparentPng(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 26) {
    return false;
  }

  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) {
      return false;
    }
  }

  let offset = 8;
  while (offset + 12 <= bytes.byteLength) {
    const chunkLength =
      (bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!;
    const chunkType = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!,
    );

    if (chunkType === "IHDR" && offset + 17 < bytes.byteLength) {
      const colorType = bytes[offset + 17];
      return colorType === 4 || colorType === 6;
    }

    if (chunkType === "IEND") {
      break;
    }

    offset += 12 + chunkLength;
  }

  return false;
}

/**
 * Export wrapper — UI must call this (124B engine only, test X).
 * Do not duplicate watermark export logic in React components.
 */
export const exportWatermarkedPdf = watermarkPdfDocument;

export { buildWatermarkedPdfFilename, watermarkPdfDocument };
