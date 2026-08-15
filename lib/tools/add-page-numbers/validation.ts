import {
  DEFAULT_PAGE_NUMBER_COLOR,
  DEFAULT_PAGE_NUMBER_FONT_SIZE,
  DEFAULT_PAGE_NUMBER_MARGIN,
  MAX_PAGE_NUMBER_FONT_SIZE,
  MAX_PAGE_NUMBER_MARGIN,
  MAX_STARTING_NUMBER,
  MIN_PAGE_NUMBER_FONT_SIZE,
  MIN_PAGE_NUMBER_MARGIN,
  MIN_STARTING_NUMBER,
  PAGE_NUMBER_MARGIN_LARGE,
  PAGE_NUMBER_MARGIN_MEDIUM,
  PAGE_NUMBER_MARGIN_SMALL,
} from "./limits";
import { resolvePageSelectionToZeroBased } from "./page-range";
import type {
  PageNumberFormat,
  PageNumberOptions,
  PageNumberPosition,
  ValidatedPageNumberOptions,
} from "./types";
import { AddPageNumbersError } from "./types";

const PAGE_NUMBER_FORMATS: PageNumberFormat[] = [
  "number",
  "page-number",
  "number-of-total",
  "page-number-of-total",
];

const PAGE_NUMBER_POSITIONS: PageNumberPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const ALLOWED_MARGINS = new Set([
  PAGE_NUMBER_MARGIN_SMALL,
  PAGE_NUMBER_MARGIN_MEDIUM,
  PAGE_NUMBER_MARGIN_LARGE,
]);

export interface ParsedHexColor {
  r: number;
  g: number;
  b: number;
}

/** Parse #RRGGBB or #RGB hex to 0–1 RGB floats for pdf-lib. */
export function validateHexColor(input: string): ParsedHexColor {
  const trimmed = input.trim();
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(trimmed);

  if (!match) {
    throw new AddPageNumbersError(
      "INVALID_COLOR",
      "Enter a valid hex color such as #000000 or #FF6600.",
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

export function validateFontSize(fontSize: number): number {
  if (!Number.isFinite(fontSize) || !Number.isInteger(fontSize)) {
    throw new AddPageNumbersError(
      "INVALID_FONT_SIZE",
      "Font size must be a whole number.",
    );
  }

  if (fontSize < MIN_PAGE_NUMBER_FONT_SIZE || fontSize > MAX_PAGE_NUMBER_FONT_SIZE) {
    throw new AddPageNumbersError(
      "INVALID_FONT_SIZE",
      `Font size must be between ${MIN_PAGE_NUMBER_FONT_SIZE} and ${MAX_PAGE_NUMBER_FONT_SIZE} points.`,
    );
  }

  return fontSize;
}

export function validateMargin(margin: number): number {
  if (!Number.isFinite(margin) || !Number.isInteger(margin)) {
    throw new AddPageNumbersError(
      "INVALID_MARGIN",
      "Margin must be a whole number of points.",
    );
  }

  if (margin < MIN_PAGE_NUMBER_MARGIN || margin > MAX_PAGE_NUMBER_MARGIN) {
    throw new AddPageNumbersError(
      "INVALID_MARGIN",
      `Margin must be between ${MIN_PAGE_NUMBER_MARGIN} and ${MAX_PAGE_NUMBER_MARGIN} points.`,
    );
  }

  if (!ALLOWED_MARGINS.has(margin)) {
    throw new AddPageNumbersError(
      "INVALID_MARGIN",
      `Margin must be one of ${PAGE_NUMBER_MARGIN_SMALL}, ${PAGE_NUMBER_MARGIN_MEDIUM}, or ${PAGE_NUMBER_MARGIN_LARGE} points.`,
    );
  }

  return margin;
}

export function validateStartingNumber(startingNumber: number): number {
  if (!Number.isFinite(startingNumber) || !Number.isInteger(startingNumber)) {
    throw new AddPageNumbersError(
      "INVALID_START_NUMBER",
      "Starting number must be a whole number.",
    );
  }

  if (
    startingNumber < MIN_STARTING_NUMBER ||
    startingNumber > MAX_STARTING_NUMBER
  ) {
    throw new AddPageNumbersError(
      "INVALID_START_NUMBER",
      `Starting number must be between ${MIN_STARTING_NUMBER} and ${MAX_STARTING_NUMBER}.`,
    );
  }

  return startingNumber;
}

function assertFormat(format: PageNumberFormat): PageNumberFormat {
  if (!PAGE_NUMBER_FORMATS.includes(format)) {
    throw new AddPageNumbersError(
      "EXPORT_FAILED",
      "Unsupported page number format.",
    );
  }
  return format;
}

function assertPosition(position: PageNumberPosition): PageNumberPosition {
  if (!PAGE_NUMBER_POSITIONS.includes(position)) {
    throw new AddPageNumbersError(
      "EXPORT_FAILED",
      "Unsupported page number position.",
    );
  }
  return position;
}

export function validatePageNumberOptions(
  options: PageNumberOptions,
  totalPages: number,
): ValidatedPageNumberOptions {
  const selection = resolvePageSelectionToZeroBased(
    options.allPages,
    options.pageRangeInput,
    totalPages,
  );

  if (selection.error) {
    throw new AddPageNumbersError("INVALID_PAGE_RANGE", selection.error);
  }

  if (selection.zeroBasedIndices.length === 0) {
    throw new AddPageNumbersError(
      "EMPTY_SELECTION",
      "Select at least one page to number.",
    );
  }

  return {
    selectedPageIndices: selection.zeroBasedIndices,
    startingNumber: validateStartingNumber(options.startingNumber),
    format: assertFormat(options.format),
    position: assertPosition(options.position),
    fontSize: validateFontSize(options.fontSize ?? DEFAULT_PAGE_NUMBER_FONT_SIZE),
    margin: validateMargin(options.margin ?? DEFAULT_PAGE_NUMBER_MARGIN),
    color: validateHexColor(options.color ?? DEFAULT_PAGE_NUMBER_COLOR),
  };
}

export function isAcceptedPageNumbersPdfFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return file.name.toLowerCase().endsWith(".pdf");
}

export function assertAcceptedPageNumbersPdfFile(file: File): void {
  if (!isAcceptedPageNumbersPdfFile(file)) {
    throw new AddPageNumbersError(
      "WRONG_FILE_TYPE",
      "Upload a PDF file to add page numbers.",
    );
  }
}
