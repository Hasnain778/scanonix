import {
  getPrimaryCategory,
  getToolCategoryMeta,
  toolMatchesCategoryFilter,
  TOP_LEVEL_CATEGORY_FILTERS,
  type PrimaryToolCategory,
  type ToolCategoryFilterId,
} from "@/constants/tool-categories";
import { HOMEPAGE_TOOLS } from "@/constants/homepage-tools";
import { getToolAccess, type ToolAccessConfig } from "@/lib/plan/tool-access";

export {
  TOP_LEVEL_CATEGORY_FILTERS as TOOL_CATEGORY_FILTERS,
  PDF_SUBCATEGORY_FILTERS,
  type ToolCategoryFilterId,
  type ToolCategoryId,
} from "@/constants/tool-categories";

/** Discovery aliases excluded from /tools (still searchable via HOMEPAGE_TOOLS). */
const DIRECTORY_EXCLUDED_IDS = new Set(["website-monitoring", "website-scanner"]);

export interface ToolDirectoryEntry {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: string;
  category: PrimaryToolCategory;
  categories: PrimaryToolCategory[];
  pdfSubcategory?: string;
  displayOrder: number;
  privacyBadge?: string;
  featured?: boolean;
}

export const FEATURED_TOOL_IDS = [
  "merge-pdf",
  "image-to-pdf",
  "compress-pdf",
  "ocr",
  "background-remover",
] as const;

const CATEGORY_LABELS: Record<PrimaryToolCategory, string> = {
  pdf: "PDF",
  image: "Image",
  ai: "AI",
  security: "Security",
};

function formatPrivacyBadge(access: ToolAccessConfig): string {
  const proPrefix = access.requiresPro ? "Pro · " : "";
  if (access.processing === "client") {
    return `${proPrefix}Processed in your browser`;
  }
  return `${proPrefix}Secure server processing`;
}

function buildDirectoryEntry(
  tool: (typeof HOMEPAGE_TOOLS)[number],
): ToolDirectoryEntry {
  const access = getToolAccess(tool.id);
  const categoryMeta = getToolCategoryMeta(tool.id);
  const category =
    categoryMeta?.primaryCategory ?? (tool.category as PrimaryToolCategory);

  return {
    id: tool.id,
    name: tool.name,
    description: tool.description,
    href: tool.href,
    icon: tool.icon,
    category,
    categories: [category],
    pdfSubcategory: categoryMeta?.pdfSubcategory,
    displayOrder: categoryMeta?.displayOrder ?? 999,
    privacyBadge: access ? formatPrivacyBadge(access) : undefined,
    featured: (FEATURED_TOOL_IDS as readonly string[]).includes(tool.id),
  };
}

/** Built from canonical category matrix + HOMEPAGE_TOOLS + TOOL_ACCESS. */
export const SCANONIX_TOOLS: ToolDirectoryEntry[] = HOMEPAGE_TOOLS.filter(
  (tool) => tool.available && !DIRECTORY_EXCLUDED_IDS.has(tool.id),
)
  .map(buildDirectoryEntry)
  .sort((a, b) => a.displayOrder - b.displayOrder);

export function getCategoryLabel(category: PrimaryToolCategory): string {
  return CATEGORY_LABELS[category];
}

export function filterTools(
  tools: ToolDirectoryEntry[],
  query: string,
  category: ToolCategoryFilterId,
): ToolDirectoryEntry[] {
  const normalizedQuery = query.trim().toLowerCase();

  return tools.filter((tool) => {
    const matchesCategory = toolMatchesCategoryFilter(tool.id, category);

    if (!matchesCategory) return false;

    if (!normalizedQuery) return true;

    const haystack = `${tool.name} ${tool.description}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function getFeaturedTools(
  tools: ToolDirectoryEntry[] = SCANONIX_TOOLS,
): ToolDirectoryEntry[] {
  return FEATURED_TOOL_IDS.map((id) => tools.find((tool) => tool.id === id)).filter(
    (tool): tool is ToolDirectoryEntry => tool !== undefined,
  );
}

export function getCategoryCounts(
  tools: ToolDirectoryEntry[] = SCANONIX_TOOLS,
): Record<ToolCategoryFilterId, number> {
  const topFilters = TOP_LEVEL_CATEGORY_FILTERS.map((item) => item.id);
  const pdfSubFilters = [
    "pdf",
    "organize-pdf",
    "convert-pdf",
    "edit-pdf",
    "optimize-pdf",
    "security-pdf",
  ] as const;

  const counts = {} as Record<ToolCategoryFilterId, number>;

  for (const filterId of [...topFilters, ...pdfSubFilters]) {
    counts[filterId] = tools.filter((tool) =>
      toolMatchesCategoryFilter(tool.id, filterId),
    ).length;
  }

  return counts;
}

/** @deprecated Use getPrimaryCategory from tool-categories */
export function getDirectoryPrimaryCategory(toolId: string): PrimaryToolCategory | undefined {
  return getPrimaryCategory(toolId);
}
