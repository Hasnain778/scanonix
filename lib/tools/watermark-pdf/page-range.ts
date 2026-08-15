/**
 * Page range adapter — thin wrap over Split PDF parser (import only, no Split PDF edits).
 */

import {
  buildAllPagesList,
  parsePageRangeInputToFlatPages,
  toZeroBasedIndices,
} from "@/lib/tools/split-pdf/page-ranges";

export {
  buildAllPagesList,
  parsePageRangeInputToFlatPages,
  toZeroBasedIndices,
};

export interface ResolvePageSelectionResult {
  /** 1-based sorted unique page numbers in document order. */
  pages: number[];
  error?: string;
}

/** Resolve "all pages" or a custom range string into a flat 1-based page list. */
export function resolvePageSelection(
  allPages: boolean,
  pageRangeInput: string,
  totalPages: number,
): ResolvePageSelectionResult {
  if (allPages) {
    if (totalPages === 0) {
      return { pages: [], error: "This PDF contains no pages to watermark." };
    }
    return { pages: buildAllPagesList(totalPages) };
  }

  const trimmed = pageRangeInput.trim();
  if (!trimmed) {
    return { pages: [], error: "Enter at least one page range." };
  }

  return parsePageRangeInputToFlatPages(trimmed, totalPages);
}

/** Convert resolved 1-based pages to sorted unique 0-based indices. */
export function resolvePageSelectionToZeroBased(
  allPages: boolean,
  pageRangeInput: string,
  totalPages: number,
): ResolvePageSelectionResult & { zeroBasedIndices: number[] } {
  const result = resolvePageSelection(allPages, pageRangeInput, totalPages);
  return {
    ...result,
    zeroBasedIndices: result.error ? [] : toZeroBasedIndices(result.pages),
  };
}
