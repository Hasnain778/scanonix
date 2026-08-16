/**
 * Canonical tool category metadata — single source for /tools filters,
 * homepage sections, nav dropdowns, breadcrumbs, and verification scripts.
 */

export type PrimaryToolCategory = "pdf" | "image" | "ai" | "security";

export type PdfSubcategory = "organize" | "convert" | "edit" | "optimize" | "security";

/** URL-facing directory filter ids (query param `category=`). */
export type ToolCategoryFilterId =
  | "all"
  | "pdf"
  | "image"
  | "ai"
  | "security"
  | "organize-pdf"
  | "convert-pdf"
  | "edit-pdf"
  | "optimize-pdf"
  | "security-pdf";

export type ToolCategoryId = Exclude<ToolCategoryFilterId, "all">;

export interface ToolCategoryMeta {
  toolId: string;
  primaryCategory: PrimaryToolCategory;
  pdfSubcategory?: PdfSubcategory;
  displayOrder: number;
}

/** All 36 canonical workspace tools with primary category + optional PDF subcategory. */
export const TOOL_CATEGORY_MATRIX: ToolCategoryMeta[] = [
  // PDF — Organize
  { toolId: "merge-pdf", primaryCategory: "pdf", pdfSubcategory: "organize", displayOrder: 10 },
  { toolId: "split-pdf", primaryCategory: "pdf", pdfSubcategory: "organize", displayOrder: 20 },
  { toolId: "organize-pdf", primaryCategory: "pdf", pdfSubcategory: "organize", displayOrder: 30 },
  { toolId: "rotate-pdf", primaryCategory: "pdf", pdfSubcategory: "organize", displayOrder: 40 },
  // PDF — Convert
  { toolId: "pdf-to-word", primaryCategory: "pdf", pdfSubcategory: "convert", displayOrder: 50 },
  { toolId: "word-to-pdf", primaryCategory: "pdf", pdfSubcategory: "convert", displayOrder: 60 },
  { toolId: "pdf-to-image", primaryCategory: "pdf", pdfSubcategory: "convert", displayOrder: 70 },
  { toolId: "image-to-pdf", primaryCategory: "pdf", pdfSubcategory: "convert", displayOrder: 80 },
  // PDF — Edit
  { toolId: "fill-pdf", primaryCategory: "pdf", pdfSubcategory: "edit", displayOrder: 90 },
  { toolId: "crop-pdf", primaryCategory: "pdf", pdfSubcategory: "edit", displayOrder: 100 },
  { toolId: "watermark-pdf", primaryCategory: "pdf", pdfSubcategory: "edit", displayOrder: 110 },
  { toolId: "add-page-numbers", primaryCategory: "pdf", pdfSubcategory: "edit", displayOrder: 120 },
  { toolId: "sign-pdf", primaryCategory: "pdf", pdfSubcategory: "edit", displayOrder: 130 },
  // PDF — Optimize
  { toolId: "compress-pdf", primaryCategory: "pdf", pdfSubcategory: "optimize", displayOrder: 140 },
  // PDF — Security
  { toolId: "protect-pdf", primaryCategory: "pdf", pdfSubcategory: "security", displayOrder: 150 },
  { toolId: "unlock-pdf", primaryCategory: "pdf", pdfSubcategory: "security", displayOrder: 160 },
  { toolId: "redact-pdf", primaryCategory: "pdf", pdfSubcategory: "security", displayOrder: 170 },
  { toolId: "metadata-cleaner", primaryCategory: "pdf", pdfSubcategory: "security", displayOrder: 180 },
  // Image
  { toolId: "background-remover", primaryCategory: "image", displayOrder: 200 },
  { toolId: "image-compressor", primaryCategory: "image", displayOrder: 210 },
  { toolId: "image-resizer", primaryCategory: "image", displayOrder: 220 },
  { toolId: "image-upscaler", primaryCategory: "image", displayOrder: 230 },
  { toolId: "png-to-jpg", primaryCategory: "image", displayOrder: 240 },
  { toolId: "jpg-to-png", primaryCategory: "image", displayOrder: 250 },
  { toolId: "png-to-webp", primaryCategory: "image", displayOrder: 260 },
  { toolId: "jpg-to-webp", primaryCategory: "image", displayOrder: 270 },
  { toolId: "webp-to-jpg", primaryCategory: "image", displayOrder: 280 },
  { toolId: "webp-to-png", primaryCategory: "image", displayOrder: 290 },
  { toolId: "heic-to-jpg", primaryCategory: "image", displayOrder: 300 },
  { toolId: "heic-to-png", primaryCategory: "image", displayOrder: 310 },
  // AI
  { toolId: "ocr", primaryCategory: "ai", displayOrder: 400 },
  { toolId: "ai-translate", primaryCategory: "ai", displayOrder: 410 },
  { toolId: "ai-summary", primaryCategory: "ai", displayOrder: 420 },
  { toolId: "ai-rewrite", primaryCategory: "ai", displayOrder: 430 },
  { toolId: "qr-scanner", primaryCategory: "ai", displayOrder: 440 },
  // Site security (non-PDF)
  { toolId: "security-scan", primaryCategory: "security", displayOrder: 500 },
];

const MATRIX_BY_ID = new Map(TOOL_CATEGORY_MATRIX.map((entry) => [entry.toolId, entry]));

export const CANONICAL_TOOL_IDS = TOOL_CATEGORY_MATRIX.map((entry) => entry.toolId);

export const TOP_LEVEL_CATEGORY_FILTERS = [
  { id: "all" as const, label: "All" },
  { id: "pdf" as const, label: "PDF" },
  { id: "image" as const, label: "Image" },
  { id: "ai" as const, label: "AI" },
  { id: "security" as const, label: "Security" },
];

export const PDF_SUBCATEGORY_FILTERS = [
  { id: "pdf" as const, label: "All PDF" },
  { id: "organize-pdf" as const, label: "Organize" },
  { id: "convert-pdf" as const, label: "Convert" },
  { id: "edit-pdf" as const, label: "Edit" },
  { id: "optimize-pdf" as const, label: "Optimize" },
  { id: "security-pdf" as const, label: "Security" },
] as const;

const PDF_SUBCATEGORY_PARAM_MAP: Record<
  Exclude<(typeof PDF_SUBCATEGORY_FILTERS)[number]["id"], "pdf">,
  PdfSubcategory
> = {
  "organize-pdf": "organize",
  "convert-pdf": "convert",
  "edit-pdf": "edit",
  "optimize-pdf": "optimize",
  "security-pdf": "security",
};

export function getToolCategoryMeta(toolId: string): ToolCategoryMeta | undefined {
  return MATRIX_BY_ID.get(toolId);
}

export function getPrimaryCategory(toolId: string): PrimaryToolCategory | undefined {
  return MATRIX_BY_ID.get(toolId)?.primaryCategory;
}

export function getPdfSubcategory(toolId: string): PdfSubcategory | undefined {
  return MATRIX_BY_ID.get(toolId)?.pdfSubcategory;
}

export function isPdfCategoryFilter(category: ToolCategoryFilterId): boolean {
  return (
    category === "pdf" ||
    category === "organize-pdf" ||
    category === "convert-pdf" ||
    category === "edit-pdf" ||
    category === "optimize-pdf" ||
    category === "security-pdf"
  );
}

/** Whether a tool belongs to the active directory category filter. */
export function toolMatchesCategoryFilter(
  toolId: string,
  category: ToolCategoryFilterId,
): boolean {
  if (category === "all") return true;

  const meta = MATRIX_BY_ID.get(toolId);
  if (!meta) return false;

  if (category === "pdf") {
    return meta.primaryCategory === "pdf";
  }

  if (category === "image") {
    return meta.primaryCategory === "image";
  }

  if (category === "ai") {
    return meta.primaryCategory === "ai";
  }

  if (category === "security") {
    return meta.primaryCategory === "security" || meta.pdfSubcategory === "security";
  }

  if (category in PDF_SUBCATEGORY_PARAM_MAP) {
    return meta.pdfSubcategory === PDF_SUBCATEGORY_PARAM_MAP[category as keyof typeof PDF_SUBCATEGORY_PARAM_MAP];
  }

  return false;
}

export function getActivePdfSubcategoryFilter(
  category: ToolCategoryFilterId,
): (typeof PDF_SUBCATEGORY_FILTERS)[number]["id"] {
  if (
    category === "organize-pdf" ||
    category === "convert-pdf" ||
    category === "edit-pdf" ||
    category === "optimize-pdf" ||
    category === "security-pdf"
  ) {
    return category;
  }

  return "pdf";
}

export function getCategoryFilterLabel(category: ToolCategoryFilterId): string {
  const top = TOP_LEVEL_CATEGORY_FILTERS.find((item) => item.id === category);
  if (top) return top.label;

  const pdfSub = PDF_SUBCATEGORY_FILTERS.find((item) => item.id === category);
  if (pdfSub) return pdfSub.label;

  return "All";
}

/** Tools for a homepage/security nav alias not in the 36 canonical matrix. */
export const NAV_ONLY_TOOL_CATEGORIES: Record<string, PrimaryToolCategory> = {
  "website-scanner": "security",
  "website-monitoring": "security",
};
