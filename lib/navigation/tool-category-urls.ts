import {
  type ToolCategoryFilterId,
  type ToolCategoryId,
} from "@/constants/tool-categories";

export const TOOLS_DIRECTORY_PATH = "/tools";

const VALID_DIRECTORY_CATEGORIES = new Set<ToolCategoryFilterId>([
  "all",
  "pdf",
  "image",
  "ai",
  "security",
  "organize-pdf",
  "convert-pdf",
  "edit-pdf",
  "optimize-pdf",
  "security-pdf",
]);

/** Build a deep-linkable /tools URL for the given directory category filter. */
export function getToolsCategoryHref(
  category: ToolCategoryFilterId | ToolCategoryId,
): string {
  if (category === "all") {
    return TOOLS_DIRECTORY_PATH;
  }

  return `${TOOLS_DIRECTORY_PATH}?category=${category}`;
}

/** Parse `?category=` from the URL; invalid or missing values fall back to `all`. */
export function parseToolsCategoryParam(
  value: string | null | undefined,
): ToolCategoryFilterId {
  if (!value) {
    return "all";
  }

  if (VALID_DIRECTORY_CATEGORIES.has(value as ToolCategoryFilterId)) {
    return value as ToolCategoryFilterId;
  }

  return "all";
}

export function isValidToolsCategoryParam(value: string): boolean {
  return VALID_DIRECTORY_CATEGORIES.has(value as ToolCategoryFilterId);
}
