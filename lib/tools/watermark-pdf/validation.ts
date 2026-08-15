import { Encodings } from "@pdf-lib/standard-fonts";
import {
  DEFAULT_WATERMARK_COLOR,
  DEFAULT_WATERMARK_FONT_SIZE,
  DEFAULT_WATERMARK_MARGIN,
  DEFAULT_RELATIVE_WIDTH_RATIO,
  MAX_RELATIVE_WIDTH_RATIO,
  MAX_WATERMARK_FONT_SIZE,
  MAX_WATERMARK_IMAGE_BYTES,
  MAX_WATERMARK_IMAGE_LONG_EDGE,
  MAX_WATERMARK_MARGIN,
  MAX_WATERMARK_OPACITY,
  MAX_WATERMARK_ROTATION,
  MAX_WATERMARK_TEXT_LENGTH,
  MIN_RELATIVE_WIDTH_RATIO,
  MIN_WATERMARK_FONT_SIZE,
  MIN_WATERMARK_MARGIN,
  MIN_WATERMARK_OPACITY,
  MIN_WATERMARK_ROTATION,
  WATERMARK_MARGIN_LARGE,
  WATERMARK_MARGIN_MEDIUM,
  WATERMARK_MARGIN_SMALL,
} from "./limits";
import { resolvePageSelectionToZeroBased } from "./page-range";
import type {
  ImageWatermarkOptions,
  TextWatermarkOptions,
  ValidatedImageWatermarkOptions,
  ValidatedTextWatermarkOptions,
  ValidatedWatermarkPdfOptions,
  WatermarkPdfOptions,
  WatermarkPosition,
} from "./types";
import { WatermarkPdfError } from "./types";

const WATERMARK_POSITIONS: WatermarkPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "center",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const ALLOWED_MARGINS = new Set([
  WATERMARK_MARGIN_SMALL,
  WATERMARK_MARGIN_MEDIUM,
  WATERMARK_MARGIN_LARGE,
]);

export interface ParsedHexColor {
  r: number;
  g: number;
  b: number;
}

function toCodePoint(character: string): number {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) {
    return -1;
  }
  return codePoint;
}

export function containsUnsupportedWinAnsiCharacters(text: string): boolean {
  for (const character of text) {
    if (!Encodings.WinAnsi.canEncodeUnicodeCodePoint(toCodePoint(character))) {
      return true;
    }
  }
  return false;
}

export function findUnsupportedWinAnsiCharacters(text: string): string[] {
  const unsupported: string[] = [];

  for (const character of text) {
    if (!Encodings.WinAnsi.canEncodeUnicodeCodePoint(toCodePoint(character))) {
      if (!unsupported.includes(character)) {
        unsupported.push(character);
      }
    }
  }

  return unsupported;
}

/** Parse #RRGGBB or #RGB hex to 0–1 RGB floats for pdf-lib. */
export function validateHexColor(input: string): ParsedHexColor {
  const trimmed = input.trim();
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(trimmed);

  if (!match) {
    throw new WatermarkPdfError(
      "INVALID_COLOR",
      "Enter a valid hex color such as #666666 or #FF6600.",
    );
  }

  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255;

  return { r, g, b };
}

export function validateOpacity(opacity: number): number {
  if (!Number.isFinite(opacity)) {
    throw new WatermarkPdfError(
      "INVALID_OPACITY",
      "Opacity must be a number between 0.1 and 1.0.",
    );
  }

  if (opacity < MIN_WATERMARK_OPACITY || opacity > MAX_WATERMARK_OPACITY) {
    throw new WatermarkPdfError(
      "INVALID_OPACITY",
      `Opacity must be between ${MIN_WATERMARK_OPACITY} and ${MAX_WATERMARK_OPACITY}.`,
    );
  }

  return opacity;
}

export function validateRotationDegrees(rotationDegrees: number): number {
  if (!Number.isFinite(rotationDegrees)) {
    throw new WatermarkPdfError(
      "INVALID_ROTATION",
      "Rotation must be a number between -360 and 360 degrees.",
    );
  }

  if (
    rotationDegrees < MIN_WATERMARK_ROTATION ||
    rotationDegrees > MAX_WATERMARK_ROTATION
  ) {
    throw new WatermarkPdfError(
      "INVALID_ROTATION",
      `Rotation must be between ${MIN_WATERMARK_ROTATION} and ${MAX_WATERMARK_ROTATION} degrees.`,
    );
  }

  return rotationDegrees;
}

export function validateFontSize(fontSize: number): number {
  if (!Number.isFinite(fontSize) || !Number.isInteger(fontSize)) {
    throw new WatermarkPdfError(
      "INVALID_FONT_SIZE",
      "Font size must be a whole number.",
    );
  }

  if (fontSize < MIN_WATERMARK_FONT_SIZE || fontSize > MAX_WATERMARK_FONT_SIZE) {
    throw new WatermarkPdfError(
      "INVALID_FONT_SIZE",
      `Font size must be between ${MIN_WATERMARK_FONT_SIZE} and ${MAX_WATERMARK_FONT_SIZE} points.`,
    );
  }

  return fontSize;
}

export function validateMargin(margin: number): number {
  if (!Number.isFinite(margin) || !Number.isInteger(margin)) {
    throw new WatermarkPdfError(
      "INVALID_MARGIN",
      "Margin must be a whole number of points.",
    );
  }

  if (margin < MIN_WATERMARK_MARGIN || margin > MAX_WATERMARK_MARGIN) {
    throw new WatermarkPdfError(
      "INVALID_MARGIN",
      `Margin must be between ${MIN_WATERMARK_MARGIN} and ${MAX_WATERMARK_MARGIN} points.`,
    );
  }

  if (!ALLOWED_MARGINS.has(margin)) {
    throw new WatermarkPdfError(
      "INVALID_MARGIN",
      `Margin must be one of ${WATERMARK_MARGIN_SMALL}, ${WATERMARK_MARGIN_MEDIUM}, or ${WATERMARK_MARGIN_LARGE} points.`,
    );
  }

  return margin;
}

export function validateRelativeWidthRatio(relativeWidthRatio: number): number {
  if (!Number.isFinite(relativeWidthRatio)) {
    throw new WatermarkPdfError(
      "INVALID_SCALE",
      "Image scale must be a number.",
    );
  }

  if (
    relativeWidthRatio < MIN_RELATIVE_WIDTH_RATIO ||
    relativeWidthRatio > MAX_RELATIVE_WIDTH_RATIO
  ) {
    throw new WatermarkPdfError(
      "INVALID_SCALE",
      `Image width must be between ${MIN_RELATIVE_WIDTH_RATIO * 100}% and ${MAX_RELATIVE_WIDTH_RATIO * 100}% of the page width.`,
    );
  }

  return relativeWidthRatio;
}

export function validateWatermarkText(text: string): string {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new WatermarkPdfError(
      "INVALID_TEXT",
      "Enter watermark text or choose an image watermark.",
    );
  }

  if (trimmed.length > MAX_WATERMARK_TEXT_LENGTH) {
    throw new WatermarkPdfError(
      "TEXT_TOO_LONG",
      `Watermark text must be ${MAX_WATERMARK_TEXT_LENGTH} characters or fewer.`,
    );
  }

  const unsupported = findUnsupportedWinAnsiCharacters(trimmed);
  if (unsupported.length > 0) {
    throw new WatermarkPdfError(
      "UNSUPPORTED_CHARACTERS",
      `Watermark text contains characters that cannot be exported with standard PDF fonts: ${unsupported.join("")}`,
    );
  }

  return trimmed;
}

function assertPosition(position: WatermarkPosition): WatermarkPosition {
  if (!WATERMARK_POSITIONS.includes(position)) {
    throw new WatermarkPdfError(
      "EXPORT_FAILED",
      "Unsupported watermark position.",
    );
  }
  return position;
}

function resolveSelectedPageIndices(
  allPages: boolean,
  pageRangeInput: string,
  totalPages: number,
): number[] {
  const selection = resolvePageSelectionToZeroBased(
    allPages,
    pageRangeInput,
    totalPages,
  );

  if (selection.error) {
    throw new WatermarkPdfError("INVALID_PAGE_RANGE", selection.error);
  }

  if (selection.zeroBasedIndices.length === 0) {
    throw new WatermarkPdfError(
      "EMPTY_SELECTION",
      "Select at least one page to watermark.",
    );
  }

  return selection.zeroBasedIndices;
}

export function validateTextWatermarkOptions(
  options: TextWatermarkOptions,
  totalPages: number,
): ValidatedTextWatermarkOptions {
  return {
    type: "text",
    text: validateWatermarkText(options.text),
    position: assertPosition(options.position),
    opacity: validateOpacity(options.opacity),
    fontSize: validateFontSize(options.fontSize ?? DEFAULT_WATERMARK_FONT_SIZE),
    bold: Boolean(options.bold),
    color: validateHexColor(options.color ?? DEFAULT_WATERMARK_COLOR),
    margin: validateMargin(options.margin ?? DEFAULT_WATERMARK_MARGIN),
    rotationDegrees: validateRotationDegrees(options.rotationDegrees ?? 0),
    selectedPageIndices: resolveSelectedPageIndices(
      options.allPages,
      options.pageRangeInput,
      totalPages,
    ),
  };
}

export function validateImageWatermarkOptions(
  options: ImageWatermarkOptions,
  totalPages: number,
): ValidatedImageWatermarkOptions {
  if (!options.imageBytes || options.imageBytes.byteLength === 0) {
    throw new WatermarkPdfError(
      "INVALID_IMAGE",
      "Choose a PNG or JPEG image for the watermark.",
    );
  }

  if (options.imageBytes.byteLength > MAX_WATERMARK_IMAGE_BYTES) {
    throw new WatermarkPdfError(
      "IMAGE_TOO_LARGE",
      `Image watermark must be ${Math.round(MAX_WATERMARK_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`,
    );
  }

  return {
    type: "image",
    imageBytes: options.imageBytes,
    position: assertPosition(options.position),
    opacity: validateOpacity(options.opacity),
    relativeWidthRatio: validateRelativeWidthRatio(
      options.relativeWidthRatio ?? DEFAULT_RELATIVE_WIDTH_RATIO,
    ),
    margin: validateMargin(options.margin ?? DEFAULT_WATERMARK_MARGIN),
    rotationDegrees: validateRotationDegrees(options.rotationDegrees ?? 0),
    selectedPageIndices: resolveSelectedPageIndices(
      options.allPages,
      options.pageRangeInput,
      totalPages,
    ),
  };
}

export function validateWatermarkPdfOptions(
  options: WatermarkPdfOptions,
  totalPages: number,
): ValidatedWatermarkPdfOptions {
  if (options.type === "text") {
    return validateTextWatermarkOptions(options, totalPages);
  }

  return validateImageWatermarkOptions(options, totalPages);
}

export function validateImageDimensions(
  width: number,
  height: number,
): void {
  const longEdge = Math.max(width, height);
  if (longEdge > MAX_WATERMARK_IMAGE_LONG_EDGE) {
    throw new WatermarkPdfError(
      "IMAGE_TOO_BIG",
      `Image watermark must be ${MAX_WATERMARK_IMAGE_LONG_EDGE}px or smaller on its longest edge.`,
    );
  }
}

export function isAcceptedWatermarkPdfFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return file.name.toLowerCase().endsWith(".pdf");
}

export const ACCEPTED_WATERMARK_IMAGE_ACCEPT =
  "image/png,image/jpeg,.png,.jpg,.jpeg";

export function isAcceptedWatermarkImageFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  if (file.type === "image/png" || lowerName.endsWith(".png")) {
    return true;
  }
  if (
    file.type === "image/jpeg" ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg")
  ) {
    return true;
  }
  return false;
}

/** User-facing error when a watermark image file is rejected. */
export function getWatermarkImageFileError(file: File): string | undefined {
  if (isAcceptedWatermarkImageFile(file)) {
    return undefined;
  }

  const lowerName = file.name.toLowerCase();
  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "Watermark image must be PNG or JPEG. PDF files cannot be used as a watermark image.";
  }
  if (file.type === "image/gif" || lowerName.endsWith(".gif")) {
    return "GIF images are not supported. Choose a PNG or JPEG.";
  }
  if (file.type === "image/webp" || lowerName.endsWith(".webp")) {
    return "WebP images are not supported. Choose a PNG or JPEG.";
  }
  if (file.type === "image/svg+xml" || lowerName.endsWith(".svg")) {
    return "SVG images are not supported. Choose a PNG or JPEG.";
  }

  return "Choose a PNG or JPEG image for the watermark.";
}

export function assertAcceptedWatermarkPdfFile(file: File): void {
  if (!isAcceptedWatermarkPdfFile(file)) {
    throw new WatermarkPdfError(
      "WRONG_FILE_TYPE",
      "Upload a PDF file to add a watermark.",
    );
  }
}

export function canUseBoldFont(text: string, boldRequested: boolean): boolean {
  return boldRequested && !containsUnsupportedWinAnsiCharacters(text);
}
