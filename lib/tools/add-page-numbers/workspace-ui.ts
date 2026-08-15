/** Workspace UI helpers for Add Page Numbers (Phase 122C). */

import {
  PAGE_NUMBER_MARGIN_LARGE,
  PAGE_NUMBER_MARGIN_MEDIUM,
  PAGE_NUMBER_MARGIN_SMALL,
} from "./limits";
import { computeDisplayNumber, formatPageNumber } from "./numbering";
import { resolvePageSelection } from "./page-range";
import type { PageNumberFormat, PageNumberPosition } from "./types";

export const PAGE_NUMBERS_UI_PRIVACY_COPY =
  "Your PDF is processed locally in your browser and is not uploaded to Scanonix servers.";

export const MARGIN_PRESET_OPTIONS = [
  { label: "Small", value: PAGE_NUMBER_MARGIN_SMALL },
  { label: "Medium", value: PAGE_NUMBER_MARGIN_MEDIUM },
  { label: "Large", value: PAGE_NUMBER_MARGIN_LARGE },
] as const;

export type MarginPresetValue = (typeof MARGIN_PRESET_OPTIONS)[number]["value"];

export const FORMAT_OPTIONS: Array<{
  value: PageNumberFormat;
  label: string;
  example: string;
}> = [
  { value: "number", label: "Number only", example: "1" },
  { value: "page-number", label: "Page prefix", example: "Page 1" },
  {
    value: "number-of-total",
    label: "Number of total",
    example: "1 of N",
  },
  {
    value: "page-number-of-total",
    label: "Page of total",
    example: "Page 1 of N",
  },
];

export const POSITION_GRID: PageNumberPosition[][] = [
  ["top-left", "top-center", "top-right"],
  ["bottom-left", "bottom-center", "bottom-right"],
];

export function canExportPageNumbersWorkspace(
  pageCount: number,
  isExporting: boolean,
  selectionError?: string,
  selectedCount = 0,
): boolean {
  return (
    pageCount > 0 &&
    !isExporting &&
    !selectionError &&
    selectedCount > 0
  );
}

export interface PreviewNumberingResult {
  displayNumber: number | null;
  text: string | null;
  isNumbered: boolean;
  selectionError?: string;
  selectedPages: number[];
}

export function resolvePreviewNumbering(
  allPages: boolean,
  pageRangeInput: string,
  totalPages: number,
  previewPageIndex: number,
  startingNumber: number,
  format: PageNumberFormat,
): PreviewNumberingResult {
  const selection = resolvePageSelection(allPages, pageRangeInput, totalPages);

  if (selection.error) {
    return {
      displayNumber: null,
      text: null,
      isNumbered: false,
      selectionError: selection.error,
      selectedPages: [],
    };
  }

  const displayNumber = computeDisplayNumber(
    selection.pages,
    previewPageIndex,
    startingNumber,
  );

  if (displayNumber === null) {
    return {
      displayNumber: null,
      text: null,
      isNumbered: false,
      selectedPages: selection.pages,
    };
  }

  const text = formatPageNumber({
    displayNumber,
    totalInSequence: selection.pages.length,
    format,
  });

  return {
    displayNumber,
    text,
    isNumbered: true,
    selectedPages: selection.pages,
  };
}

export function getFormatPreviewExample(
  format: PageNumberFormat,
  totalInSequence = 5,
): string {
  return formatPageNumber({
    displayNumber: 1,
    totalInSequence,
    format,
  });
}

export function getPositionLabel(position: PageNumberPosition): string {
  const [vertical, horizontal] = position.split("-") as [string, string];
  return `${vertical} ${horizontal}`;
}
