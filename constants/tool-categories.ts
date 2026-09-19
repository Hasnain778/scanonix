/**
 * Canonical tool category metadata — single source for /tools filters,
 * homepage sections, nav dropdowns, breadcrumbs, and verification scripts.
 *
 * SV2-1.1 — typed discovery subcategories for PDF / Image / AI / Security.
 */

export type PrimaryToolCategory = "pdf" | "image" | "ai" | "security";

export type PdfSubcategory =
  | "organize"
  | "convert"
  | "edit"
  | "optimize"
  | "security";

export type ImageSubcategory =
  | "convert"
  | "compress-resize"
  | "vector-design"
  | "edit-create";

export type AiSubcategory = "write-rewrite" | "extract" | "analyze";

export type SecuritySubcategory = "protect-privacy" | "scan";

/** URL-facing directory filter ids (query param `category=`). */
export type ToolCategoryFilterId =
  | "all"
  | "pdf"
  | "image"
  | "ai"
  | "security"
  // PDF
  | "organize-pdf"
  | "convert-pdf"
  | "edit-pdf"
  | "optimize-pdf"
  | "security-pdf"
  // Image
  | "convert-image"
  | "compress-image"
  | "vector-image"
  | "edit-image"
  // AI
  | "write-ai"
  | "extract-ai"
  | "analyze-ai"
  // Security
  | "protect-security"
  | "scan-security";

export type ToolCategoryId = Exclude<ToolCategoryFilterId, "all">;

export interface ToolCategoryMeta {
  toolId: string;
  primaryCategory: PrimaryToolCategory;
  /** PDF intent group (PDF tools only). */
  pdfSubcategory?: PdfSubcategory;
  /** Image intent group (Image tools only). */
  imageSubcategory?: ImageSubcategory;
  /** AI intent group (AI tools only). */
  aiSubcategory?: AiSubcategory;
  /**
   * Security discovery intent.
   * PDF privacy tools use protect-privacy while remaining primary=pdf.
   */
  securitySubcategory?: SecuritySubcategory;
  displayOrder: number;
}

/**
 * Future public Image Editor placement (SV2-1.1 architecture note):
 * When Image Editor graduates from /dev/image-editor, assign:
 *   primaryCategory: "image"
 *   imageSubcategory: "edit-create"
 * Do NOT expose /dev/image-editor in discovery until that release phase.
 */

/** All 41 canonical workspace tools with primary + discovery subcategory. */
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
  // PDF — Compress & Optimize
  { toolId: "compress-pdf", primaryCategory: "pdf", pdfSubcategory: "optimize", displayOrder: 140 },
  // PDF — Security (+ Security primary Protect & Privacy)
  {
    toolId: "protect-pdf",
    primaryCategory: "pdf",
    pdfSubcategory: "security",
    securitySubcategory: "protect-privacy",
    displayOrder: 150,
  },
  {
    toolId: "unlock-pdf",
    primaryCategory: "pdf",
    pdfSubcategory: "security",
    securitySubcategory: "protect-privacy",
    displayOrder: 160,
  },
  {
    toolId: "redact-pdf",
    primaryCategory: "pdf",
    pdfSubcategory: "security",
    securitySubcategory: "protect-privacy",
    displayOrder: 170,
  },
  {
    toolId: "metadata-cleaner",
    primaryCategory: "pdf",
    pdfSubcategory: "security",
    securitySubcategory: "protect-privacy",
    displayOrder: 180,
  },
  // Image — Compress & Resize
  {
    toolId: "image-compressor",
    primaryCategory: "image",
    imageSubcategory: "compress-resize",
    displayOrder: 210,
  },
  {
    toolId: "image-resizer",
    primaryCategory: "image",
    imageSubcategory: "compress-resize",
    displayOrder: 220,
  },
  {
    toolId: "image-upscaler",
    primaryCategory: "image",
    imageSubcategory: "compress-resize",
    displayOrder: 230,
  },
  // Image — Vector & Design
  {
    toolId: "logo-vectorizer",
    primaryCategory: "image",
    imageSubcategory: "vector-design",
    displayOrder: 235,
  },
  {
    toolId: "image-to-svg",
    primaryCategory: "image",
    imageSubcategory: "vector-design",
    displayOrder: 237,
  },
  {
    toolId: "raster-to-vector",
    primaryCategory: "image",
    imageSubcategory: "vector-design",
    displayOrder: 238,
  },
  // Image — Edit & Create (Image Editor first; PSD converters follow)
  {
    toolId: "image-editor",
    primaryCategory: "image",
    imageSubcategory: "edit-create",
    displayOrder: 239,
  },
  {
    toolId: "png-to-jpg",
    primaryCategory: "image",
    imageSubcategory: "convert",
    displayOrder: 240,
  },
  {
    toolId: "jpg-to-psd",
    primaryCategory: "image",
    imageSubcategory: "edit-create",
    displayOrder: 241,
  },
  {
    toolId: "png-to-psd",
    primaryCategory: "image",
    imageSubcategory: "edit-create",
    displayOrder: 242,
  },
  {
    toolId: "jpg-to-png",
    primaryCategory: "image",
    imageSubcategory: "convert",
    displayOrder: 250,
  },
  {
    toolId: "png-to-webp",
    primaryCategory: "image",
    imageSubcategory: "convert",
    displayOrder: 260,
  },
  {
    toolId: "jpg-to-webp",
    primaryCategory: "image",
    imageSubcategory: "convert",
    displayOrder: 270,
  },
  {
    toolId: "webp-to-jpg",
    primaryCategory: "image",
    imageSubcategory: "convert",
    displayOrder: 280,
  },
  {
    toolId: "webp-to-png",
    primaryCategory: "image",
    imageSubcategory: "convert",
    displayOrder: 290,
  },
  {
    toolId: "heic-to-jpg",
    primaryCategory: "image",
    imageSubcategory: "convert",
    displayOrder: 300,
  },
  {
    toolId: "heic-to-png",
    primaryCategory: "image",
    imageSubcategory: "convert",
    displayOrder: 310,
  },
  // AI
  { toolId: "ocr", primaryCategory: "ai", aiSubcategory: "extract", displayOrder: 400 },
  {
    toolId: "ai-translate",
    primaryCategory: "ai",
    aiSubcategory: "write-rewrite",
    displayOrder: 410,
  },
  {
    toolId: "ai-summary",
    primaryCategory: "ai",
    aiSubcategory: "analyze",
    displayOrder: 420,
  },
  {
    toolId: "ai-rewrite",
    primaryCategory: "ai",
    aiSubcategory: "write-rewrite",
    displayOrder: 430,
  },
  { toolId: "qr-scanner", primaryCategory: "ai", aiSubcategory: "extract", displayOrder: 440 },
  // Security — Scan
  {
    toolId: "security-scan",
    primaryCategory: "security",
    securitySubcategory: "scan",
    displayOrder: 500,
  },
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
  { id: "pdf" as const, label: "All" },
  { id: "organize-pdf" as const, label: "Organize" },
  { id: "convert-pdf" as const, label: "Convert" },
  { id: "edit-pdf" as const, label: "Edit" },
  { id: "optimize-pdf" as const, label: "Compress & Optimize" },
  { id: "security-pdf" as const, label: "Security" },
] as const;

export const IMAGE_SUBCATEGORY_FILTERS = [
  { id: "image" as const, label: "All" },
  { id: "convert-image" as const, label: "Convert" },
  { id: "compress-image" as const, label: "Compress & Resize" },
  { id: "vector-image" as const, label: "Vector & Design" },
  { id: "edit-image" as const, label: "Edit & Create" },
] as const;

export const AI_SUBCATEGORY_FILTERS = [
  { id: "ai" as const, label: "All" },
  { id: "write-ai" as const, label: "Write & Rewrite" },
  { id: "extract-ai" as const, label: "Extract" },
  { id: "analyze-ai" as const, label: "Analyze" },
] as const;

export const SECURITY_SUBCATEGORY_FILTERS = [
  { id: "security" as const, label: "All" },
  { id: "protect-security" as const, label: "Protect & Privacy" },
  { id: "scan-security" as const, label: "Scan" },
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

const IMAGE_SUBCATEGORY_PARAM_MAP: Record<
  Exclude<(typeof IMAGE_SUBCATEGORY_FILTERS)[number]["id"], "image">,
  ImageSubcategory
> = {
  "convert-image": "convert",
  "compress-image": "compress-resize",
  "vector-image": "vector-design",
  "edit-image": "edit-create",
};

const AI_SUBCATEGORY_PARAM_MAP: Record<
  Exclude<(typeof AI_SUBCATEGORY_FILTERS)[number]["id"], "ai">,
  AiSubcategory
> = {
  "write-ai": "write-rewrite",
  "extract-ai": "extract",
  "analyze-ai": "analyze",
};

const SECURITY_SUBCATEGORY_PARAM_MAP: Record<
  Exclude<(typeof SECURITY_SUBCATEGORY_FILTERS)[number]["id"], "security">,
  SecuritySubcategory
> = {
  "protect-security": "protect-privacy",
  "scan-security": "scan",
};

export type SubcategoryFilterItem = {
  id: ToolCategoryFilterId;
  label: string;
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

export function getImageSubcategory(toolId: string): ImageSubcategory | undefined {
  return MATRIX_BY_ID.get(toolId)?.imageSubcategory;
}

export function getAiSubcategory(toolId: string): AiSubcategory | undefined {
  return MATRIX_BY_ID.get(toolId)?.aiSubcategory;
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

export function isImageCategoryFilter(category: ToolCategoryFilterId): boolean {
  return (
    category === "image" ||
    category === "convert-image" ||
    category === "compress-image" ||
    category === "vector-image" ||
    category === "edit-image"
  );
}

export function isAiCategoryFilter(category: ToolCategoryFilterId): boolean {
  return (
    category === "ai" ||
    category === "write-ai" ||
    category === "extract-ai" ||
    category === "analyze-ai"
  );
}

export function isSecurityCategoryFilter(category: ToolCategoryFilterId): boolean {
  return (
    category === "security" ||
    category === "protect-security" ||
    category === "scan-security"
  );
}

/** True when a primary category (not All) is selected — including any of its subfilters. */
export function getPrimaryFamily(
  category: ToolCategoryFilterId,
): PrimaryToolCategory | null {
  if (isPdfCategoryFilter(category)) return "pdf";
  if (isImageCategoryFilter(category)) return "image";
  if (isAiCategoryFilter(category)) return "ai";
  if (isSecurityCategoryFilter(category)) return "security";
  return null;
}

/** Second-level filters for the active primary family. Empty for All. */
export function getSubcategoryFilters(
  category: ToolCategoryFilterId,
): readonly SubcategoryFilterItem[] {
  const family = getPrimaryFamily(category);
  if (family === "pdf") return PDF_SUBCATEGORY_FILTERS;
  if (family === "image") return IMAGE_SUBCATEGORY_FILTERS;
  if (family === "ai") return AI_SUBCATEGORY_FILTERS;
  if (family === "security") return SECURITY_SUBCATEGORY_FILTERS;
  return [];
}

/** Active subcategory chip id (the "All" chip id equals the primary family id). */
export function getActiveSubcategoryFilter(
  category: ToolCategoryFilterId,
): ToolCategoryFilterId {
  const family = getPrimaryFamily(category);
  if (!family) return "all";
  if (category === family) return family;
  return category;
}

/** Primary-family "All" filter id — used when resetting subcategory. */
export function getPrimaryAllFilter(
  category: ToolCategoryFilterId,
): ToolCategoryFilterId {
  return getPrimaryFamily(category) ?? "all";
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
    return (
      meta.primaryCategory === "security" ||
      meta.securitySubcategory === "protect-privacy" ||
      meta.pdfSubcategory === "security"
    );
  }

  if (category in PDF_SUBCATEGORY_PARAM_MAP) {
    return (
      meta.pdfSubcategory ===
      PDF_SUBCATEGORY_PARAM_MAP[category as keyof typeof PDF_SUBCATEGORY_PARAM_MAP]
    );
  }

  if (category in IMAGE_SUBCATEGORY_PARAM_MAP) {
    return (
      meta.imageSubcategory ===
      IMAGE_SUBCATEGORY_PARAM_MAP[category as keyof typeof IMAGE_SUBCATEGORY_PARAM_MAP]
    );
  }

  if (category in AI_SUBCATEGORY_PARAM_MAP) {
    return (
      meta.aiSubcategory ===
      AI_SUBCATEGORY_PARAM_MAP[category as keyof typeof AI_SUBCATEGORY_PARAM_MAP]
    );
  }

  if (category in SECURITY_SUBCATEGORY_PARAM_MAP) {
    return (
      meta.securitySubcategory ===
      SECURITY_SUBCATEGORY_PARAM_MAP[
        category as keyof typeof SECURITY_SUBCATEGORY_PARAM_MAP
      ]
    );
  }

  return false;
}

/** @deprecated Prefer getActiveSubcategoryFilter */
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

  for (const list of [
    PDF_SUBCATEGORY_FILTERS,
    IMAGE_SUBCATEGORY_FILTERS,
    AI_SUBCATEGORY_FILTERS,
    SECURITY_SUBCATEGORY_FILTERS,
  ]) {
    const hit = list.find((item) => item.id === category);
    if (hit) {
      if (hit.id === "pdf") return "PDF";
      if (hit.id === "image") return "Image";
      if (hit.id === "ai") return "AI";
      if (hit.id === "security") return "Security";
      return hit.label;
    }
  }

  return "All";
}

/** All known directory filter ids (top-level + subcategories). */
export const ALL_DIRECTORY_FILTER_IDS: ToolCategoryFilterId[] = [
  ...TOP_LEVEL_CATEGORY_FILTERS.map((item) => item.id),
  ...PDF_SUBCATEGORY_FILTERS.map((item) => item.id).filter((id) => id !== "pdf"),
  ...IMAGE_SUBCATEGORY_FILTERS.map((item) => item.id).filter((id) => id !== "image"),
  ...AI_SUBCATEGORY_FILTERS.map((item) => item.id).filter((id) => id !== "ai"),
  ...SECURITY_SUBCATEGORY_FILTERS.map((item) => item.id).filter(
    (id) => id !== "security",
  ),
];

/** Tools for a homepage/security nav alias not in the canonical matrix. */
export const NAV_ONLY_TOOL_CATEGORIES: Record<string, PrimaryToolCategory> = {
  "website-scanner": "security",
  "website-monitoring": "security",
};
