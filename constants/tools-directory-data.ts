export const TOOL_CATEGORY_FILTERS = [
  { id: "all", label: "All" },
  { id: "pdf", label: "PDF" },
  { id: "image", label: "Image" },
  { id: "ocr-ai", label: "OCR & AI" },
  { id: "qr", label: "QR" },
  { id: "mobile", label: "Mobile" },
] as const;

export type ToolCategoryFilterId = (typeof TOOL_CATEGORY_FILTERS)[number]["id"];
export type ToolCategoryId = Exclude<ToolCategoryFilterId, "all">;

export interface ToolDirectoryEntry {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: string;
  category: ToolCategoryId;
  categories: ToolCategoryId[];
  privacyBadge?: string;
  featured?: boolean;
}

export const SCANONIX_TOOLS: ToolDirectoryEntry[] = [
  {
    id: "security-scan",
    name: "Security Scan",
    description:
      "Scan websites for security risks with saved reports and history.",
    href: "/tools/security-scan",
    icon: "security",
    category: "ocr-ai",
    categories: ["ocr-ai"],
    privacyBadge: "Saved to history",
    featured: true,
  },
  {
    id: "image-to-pdf",
    name: "Image to PDF",
    description:
      "Combine JPG, JPEG, and PNG photos into a polished multi-page PDF.",
    href: "/tools/image-to-pdf",
    icon: "image-pdf",
    category: "pdf",
    categories: ["pdf"],
    privacyBadge: "Local processing",
    featured: true,
  },
  {
    id: "pdf-to-image",
    name: "PDF to Image",
    description:
      "Export PDF pages as high-quality JPG, PNG, or WEBP images.",
    href: "/tools/pdf-to-image",
    icon: "pdf-image",
    category: "pdf",
    categories: ["pdf"],
    privacyBadge: "Local processing",
  },
  {
    id: "merge-pdf",
    name: "Merge PDF",
    description: "Join multiple PDF files into one organised document.",
    href: "/tools/merge-pdf",
    icon: "merge",
    category: "pdf",
    categories: ["pdf"],
    privacyBadge: "Local processing",
    featured: true,
  },
  {
    id: "split-pdf",
    name: "Split PDF",
    description:
      "Extract selected pages or divide large PDFs into separate files.",
    href: "/tools/split-pdf",
    icon: "split",
    category: "pdf",
    categories: ["pdf"],
    privacyBadge: "Local processing",
  },
  {
    id: "rotate-pdf",
    name: "Rotate PDF",
    description:
      "Rotate PDF pages by 90°, 180°, or 270° — all pages or a custom selection.",
    href: "/tools/rotate-pdf",
    icon: "rotate-pdf",
    category: "pdf",
    categories: ["pdf"],
    privacyBadge: "Local processing",
  },
  {
    id: "compress-pdf",
    name: "Compress PDF",
    description: "Reduce PDF file size while keeping text readable.",
    href: "/tools/compress-pdf",
    icon: "compress",
    category: "pdf",
    categories: ["pdf"],
    privacyBadge: "Local processing",
  },
  {
    id: "pdf-to-word",
    name: "PDF to Word",
    description:
      "Convert PDFs into editable Word documents with OCR fallback.",
    href: "/tools/pdf-to-word",
    icon: "word",
    category: "pdf",
    categories: ["pdf"],
    privacyBadge: "Local processing",
  },
  {
    id: "jpg-to-png",
    name: "JPG to PNG",
    description:
      "Convert JPEG images to PNG with optional resize and transparency.",
    href: "/tools/jpg-to-png",
    icon: "convert",
    category: "image",
    categories: ["image"],
    privacyBadge: "Local processing",
  },
  {
    id: "png-to-jpg",
    name: "PNG to JPG",
    description: "Convert PNG images to JPG for smaller, compatible files.",
    href: "/tools/png-to-jpg",
    icon: "convert",
    category: "image",
    categories: ["image"],
    privacyBadge: "Local processing",
  },
  {
    id: "png-to-webp",
    name: "PNG to WEBP",
    description: "Convert PNG to WEBP for efficient web delivery.",
    href: "/tools/png-to-webp",
    icon: "convert",
    category: "image",
    categories: ["image"],
    privacyBadge: "Local processing",
  },
  {
    id: "jpg-to-webp",
    name: "JPG to WEBP",
    description: "Convert JPG photos to WEBP for faster page loads.",
    href: "/tools/jpg-to-webp",
    icon: "convert",
    category: "image",
    categories: ["image"],
    privacyBadge: "Local processing",
  },
  {
    id: "webp-to-jpg",
    name: "WEBP to JPG",
    description: "Convert WEBP images to widely supported JPG files.",
    href: "/tools/webp-to-jpg",
    icon: "convert",
    category: "image",
    categories: ["image"],
    privacyBadge: "Local processing",
  },
  {
    id: "webp-to-png",
    name: "WEBP to PNG",
    description: "Convert WEBP images to PNG for editing workflows.",
    href: "/tools/webp-to-png",
    icon: "convert",
    category: "image",
    categories: ["image"],
    privacyBadge: "Local processing",
  },
  {
    id: "heic-to-jpg",
    name: "HEIC to JPG",
    description: "Convert iPhone HEIC photos to JPG instantly.",
    href: "/tools/heic-to-jpg",
    icon: "convert",
    category: "image",
    categories: ["image"],
    privacyBadge: "Local processing",
    featured: true,
  },
  {
    id: "heic-to-png",
    name: "HEIC to PNG",
    description: "Convert HEIC images to PNG for lossless editing.",
    href: "/tools/heic-to-png",
    icon: "convert",
    category: "image",
    categories: ["image"],
    privacyBadge: "Local processing",
  },
  {
    id: "word-to-pdf",
    name: "Word to PDF",
    description: "Convert .docx Word documents into polished PDF files.",
    href: "/tools/word-to-pdf",
    icon: "word",
    category: "pdf",
    categories: ["pdf"],
    privacyBadge: "Server processing",
  },
  {
    id: "image-compressor",
    name: "Image Compressor",
    description: "Reduce image file size with adjustable quality settings.",
    href: "/tools/image-compressor",
    icon: "compress",
    category: "image",
    categories: ["image"],
    privacyBadge: "Server processing",
  },
  {
    id: "image-resizer",
    name: "Image Resizer",
    description: "Resize images to exact pixel dimensions.",
    href: "/tools/image-resizer",
    icon: "convert",
    category: "image",
    categories: ["image"],
    privacyBadge: "Server processing",
  },
  {
    id: "image-upscaler",
    name: "Image Upscaler",
    description: "Upscale images 2× or 4× with Lanczos resampling.",
    href: "/tools/image-upscaler",
    icon: "convert",
    category: "image",
    categories: ["image"],
    privacyBadge: "Pro · Server processing",
  },
  {
    id: "background-remover",
    name: "AI Background Remover",
    description:
      "Remove backgrounds with on-device AI. HD free, 4K for Pro.",
    href: "/tools/background-remover",
    icon: "bg-remove",
    category: "image",
    categories: ["image"],
    privacyBadge: "Local processing",
    featured: true,
  },
  {
    id: "ocr",
    name: "OCR Text Extraction",
    description:
      "Extract searchable text from scans, photos, and PDF documents.",
    href: "/tools/ocr",
    icon: "ocr",
    category: "ocr-ai",
    categories: ["ocr-ai"],
    privacyBadge: "Local processing",
    featured: true,
  },
  {
    id: "ai-summary",
    name: "AI Document Summary",
    description:
      "Summarise long documents and OCR text with cloud AI.",
    href: "/tools/ai-summary",
    icon: "ocr",
    category: "ocr-ai",
    categories: ["ocr-ai"],
    privacyBadge: "Cloud AI",
  },
  {
    id: "ai-translate",
    name: "AI Translator",
    description:
      "Translate document text into multiple languages with cloud AI.",
    href: "/tools/ai-translate",
    icon: "convert",
    category: "ocr-ai",
    categories: ["ocr-ai"],
    privacyBadge: "Cloud AI",
  },
  {
    id: "ai-rewrite",
    name: "AI Rewrite",
    description: "Rewrite text in different tones and lengths with cloud AI.",
    href: "/tools/ai-rewrite",
    icon: "ocr",
    category: "ocr-ai",
    categories: ["ocr-ai"],
    privacyBadge: "Cloud AI · Pro",
  },
  {
    id: "qr-scanner",
    name: "QR Scanner",
    description:
      "Scan QR codes with your camera or upload an image to decode instantly.",
    href: "/tools/qr-scanner",
    icon: "qr",
    category: "qr",
    categories: ["qr", "mobile"],
    privacyBadge: "Local processing",
  },
];

export const FEATURED_TOOL_IDS = [
  "merge-pdf",
  "image-to-pdf",
  "compress-pdf",
  "ocr",
  "background-remover",
] as const;

const CATEGORY_LABELS: Record<ToolCategoryId, string> = {
  pdf: "PDF",
  image: "Image",
  "ocr-ai": "OCR & AI",
  qr: "QR",
  mobile: "Mobile",
};

export function getCategoryLabel(category: ToolCategoryId): string {
  return CATEGORY_LABELS[category];
}

export function filterTools(
  tools: ToolDirectoryEntry[],
  query: string,
  category: ToolCategoryFilterId,
): ToolDirectoryEntry[] {
  const normalizedQuery = query.trim().toLowerCase();

  return tools.filter((tool) => {
    const matchesCategory =
      category === "all" || tool.categories.includes(category);

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
