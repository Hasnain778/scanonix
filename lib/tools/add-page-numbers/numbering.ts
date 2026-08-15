import type { PageNumberFormat } from "./types";

/**
 * Display number for a physical page within the selected set.
 *
 * selectedPages: 1-based page numbers, sorted ascending, unique.
 * physicalPageIndex: 0-based index in the source PDF.
 */
export function computeDisplayNumber(
  selectedPages: number[],
  physicalPageIndex: number,
  startingNumber: number,
): number | null {
  const physicalPageNumber = physicalPageIndex + 1;
  const sequenceIndex = selectedPages.indexOf(physicalPageNumber);

  if (sequenceIndex === -1) {
    return null;
  }

  return startingNumber + sequenceIndex;
}

export interface FormatPageNumberArgs {
  displayNumber: number;
  /** Count of pages in the numbering sequence (selected pages). */
  totalInSequence: number;
  format: PageNumberFormat;
}

/** Typed formatter — no user-supplied templates. */
export function formatPageNumber({
  displayNumber,
  totalInSequence,
  format,
}: FormatPageNumberArgs): string {
  switch (format) {
    case "number":
      return String(displayNumber);
    case "page-number":
      return `Page ${displayNumber}`;
    case "number-of-total":
      return `${displayNumber} of ${totalInSequence}`;
    case "page-number-of-total":
      return `Page ${displayNumber} of ${totalInSequence}`;
    default: {
      const exhaustive: never = format;
      return String(exhaustive);
    }
  }
}
