export interface PageRangeParseResult {
  groups: number[][];
  error?: string;
}

/** Convert 1-based page numbers to sorted unique 0-based indices. */
export function toZeroBasedIndices(pages: number[]): number[] {
  return [...new Set(pages.map((page) => page - 1))].sort((a, b) => a - b);
}

export function formatPageFilename(pages: number[]): string {
  const sorted = [...pages].sort((a, b) => a - b);

  if (sorted.length === 1) {
    return `scanonix-page-${sorted[0]}.pdf`;
  }

  const isContiguous = sorted.every(
    (page, index) => index === 0 || page === sorted[index - 1] + 1,
  );

  if (isContiguous) {
    return `scanonix-pages-${sorted[0]}-${sorted[sorted.length - 1]}.pdf`;
  }

  return `scanonix-pages-${sorted.join("-")}.pdf`;
}

export function parsePageRangeInput(
  input: string,
  totalPages: number,
): PageRangeParseResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { groups: [], error: "Enter at least one page range." };
  }

  const segments = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  const groups: number[][] = [];

  for (const segment of segments) {
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(segment);

    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);

      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        return { groups: [], error: `Invalid range "${segment}".` };
      }

      if (start < 1 || end < 1) {
        return { groups: [], error: "Page numbers must be at least 1." };
      }

      if (start > end) {
        return {
          groups: [],
          error: `Range "${segment}" is invalid — start must be less than or equal to end.`,
        };
      }

      if (end > totalPages) {
        return {
          groups: [],
          error: `Range "${segment}" exceeds document length (${totalPages} pages).`,
        };
      }

      const pages: number[] = [];
      for (let page = start; page <= end; page++) {
        pages.push(page);
      }
      groups.push(pages);
      continue;
    }

    if (!/^\d+$/.test(segment)) {
      return {
        groups: [],
        error: `Invalid entry "${segment}". Use formats like 1-3, 5, or 8-10.`,
      };
    }

    const page = Number(segment);

    if (page < 1) {
      return { groups: [], error: "Page numbers must be at least 1." };
    }

    if (page > totalPages) {
      return {
        groups: [],
        error: `Page ${page} exceeds document length (${totalPages} pages).`,
      };
    }

    groups.push([page]);
  }

  if (groups.length === 0) {
    return { groups: [], error: "Enter at least one valid page range." };
  }

  return { groups };
}

export function buildEveryPageGroups(totalPages: number): number[][] {
  return Array.from({ length: totalPages }, (_, index) => [index + 1]);
}

export function buildFixedIntervalGroups(
  totalPages: number,
  interval: number,
): { groups: number[][]; error?: string } {
  if (!Number.isInteger(interval) || interval < 1) {
    return { groups: [], error: "Interval must be a whole number of at least 1." };
  }

  if (interval > totalPages) {
    return {
      groups: [],
      error: `Interval (${interval}) cannot be larger than the document (${totalPages} pages).`,
    };
  }

  const groups: number[][] = [];

  for (let start = 1; start <= totalPages; start += interval) {
    const end = Math.min(start + interval - 1, totalPages);
    const pages: number[] = [];
    for (let page = start; page <= end; page++) {
      pages.push(page);
    }
    groups.push(pages);
  }

  return { groups };
}

export function buildIndividualSelectionGroup(
  selectedPages: number[],
  totalPages: number,
): { groups: number[][]; error?: string } {
  if (selectedPages.length === 0) {
    return { groups: [], error: "Select at least one page." };
  }

  const invalid = selectedPages.find((page) => page < 1 || page > totalPages);
  if (invalid !== undefined) {
    return {
      groups: [],
      error: `Page ${invalid} is outside the document range (1–${totalPages}).`,
    };
  }

  return { groups: [[...selectedPages].sort((a, b) => a - b)] };
}

export function buildAllPagesList(totalPages: number): number[] {
  return Array.from({ length: totalPages }, (_, index) => index + 1);
}

export function parsePageRangeInputToFlatPages(
  input: string,
  totalPages: number,
): { pages: number[]; error?: string } {
  const result = parsePageRangeInput(input, totalPages);

  if (result.error) {
    return { pages: [], error: result.error };
  }

  const pages = [...new Set(result.groups.flat())].sort((a, b) => a - b);
  return { pages };
}

export function formatImagePageFilename(
  page: number,
  format: "jpg" | "png" | "webp",
): string {
  return `scanonix-page-${page}.${format}`;
}
