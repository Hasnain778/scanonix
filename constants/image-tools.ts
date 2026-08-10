export type ImageFormatId = "png" | "jpg" | "webp" | "heic";

export type ImageToolBadge = "Popular" | "Fast" | "Best for web" | "Premium";

export interface ConverterFaqItem {
  question: string;
  answer: string;
}

export interface ImageConverterDefinition {
  id: string;
  slug: string;
  from: ImageFormatId;
  to: ImageFormatId;
  title: string;
  directionLabel: string;
  description: string;
  shortDescription: string;
  metaDescription: string;
  acceptExtensions: string;
  outputLabel: string;
  badge?: ImageToolBadge;
  faq: ConverterFaqItem[];
  relatedSlugs: string[];
}

export interface ImageHubTool {
  id: string;
  title: string;
  description: string;
  href: string;
  fileSupport?: string;
  badge?: ImageToolBadge;
  kind: "featured-hero" | "featured-medium" | "converter" | "edit" | "pdf-related" | "utility";
}

const BASE_FAQ_PRIVACY: ConverterFaqItem = {
  question: "Are my images uploaded to a server?",
  answer:
    "Standard format conversions run locally in your browser. Your files stay on your device unless a specific tool clearly states otherwise.",
};

function converter(
  def: Omit<ImageConverterDefinition, "directionLabel"> & {
    directionLabel?: string;
  },
): ImageConverterDefinition {
  const from = def.from.toUpperCase();
  const to = def.to === "jpg" ? "JPG" : def.to.toUpperCase();
  return {
    ...def,
    directionLabel: def.directionLabel ?? `${from} → ${to}`,
  };
}

export const IMAGE_CONVERTERS: ImageConverterDefinition[] = [
  converter({
    id: "png-to-jpg",
    slug: "png-to-jpg",
    from: "png",
    to: "jpg",
    title: "PNG to JPG",
    description:
      "Convert PNG images to JPG for smaller file sizes and broad compatibility. Transparency is flattened to a background colour before export.",
    shortDescription: "Smaller files for sharing and uploads",
    metaDescription:
      "Convert PNG to JPG online in your browser. Reduce file size, flatten transparency, and download instantly — private local processing.",
    acceptExtensions: ".png",
    outputLabel: "JPG",
    badge: "Popular",
    relatedSlugs: ["png-to-webp", "jpg-to-png", "webp-to-jpg"],
    faq: [
      BASE_FAQ_PRIVACY,
      {
        question: "What happens to transparent areas?",
        answer:
          "JPG does not support transparency. Transparent pixels are flattened onto a white background by default. You can choose a different background colour before converting.",
      },
      {
        question: "Will image quality change?",
        answer:
          "You can adjust JPG quality before export. Higher quality keeps more detail but produces larger files.",
      },
    ],
  }),
  converter({
    id: "png-to-webp",
    slug: "png-to-webp",
    from: "png",
    to: "webp",
    title: "PNG to WEBP",
    description:
      "Convert PNG files to WEBP for modern web delivery with smaller payloads while keeping strong visual quality.",
    shortDescription: "Modern web format with smaller payloads",
    metaDescription:
      "Convert PNG to WEBP in your browser. Optimise images for websites with fast, local conversion and instant download.",
    acceptExtensions: ".png",
    outputLabel: "WEBP",
    badge: "Best for web",
    relatedSlugs: ["png-to-jpg", "webp-to-png", "jpg-to-webp"],
    faq: [
      BASE_FAQ_PRIVACY,
      {
        question: "Does WEBP support transparency?",
        answer: "Yes. WEBP can preserve transparency from PNG sources when converted in the browser.",
      },
    ],
  }),
  converter({
    id: "jpg-to-png",
    slug: "jpg-to-png",
    from: "jpg",
    to: "png",
    title: "JPG to PNG",
    description:
      "Convert JPG and JPEG photos to PNG for lossless output and workflows that require a raster format without JPG compression artefacts.",
    shortDescription: "Lossless output for editing workflows",
    metaDescription:
      "Convert JPG to PNG online. Upload JPEG images, convert locally in your browser, and download PNG files instantly.",
    acceptExtensions: ".jpg,.jpeg",
    outputLabel: "PNG",
    relatedSlugs: ["png-to-jpg", "jpg-to-webp", "heic-to-png"],
    faq: [
      BASE_FAQ_PRIVACY,
      {
        question: "Can I convert multiple JPG files?",
        answer: "Yes. Add several JPEG images and download them individually or as a ZIP archive.",
      },
    ],
  }),
  converter({
    id: "jpg-to-webp",
    slug: "jpg-to-webp",
    from: "jpg",
    to: "webp",
    title: "JPG to WEBP",
    description:
      "Convert JPG photos to WEBP for faster page loads and efficient storage without leaving your browser.",
    shortDescription: "Efficient format for websites and apps",
    metaDescription:
      "Convert JPG to WEBP locally in your browser. Reduce image weight for the web while keeping strong visual quality.",
    acceptExtensions: ".jpg,.jpeg",
    outputLabel: "WEBP",
    badge: "Best for web",
    relatedSlugs: ["png-to-webp", "webp-to-jpg", "jpg-to-png"],
    faq: [BASE_FAQ_PRIVACY],
  }),
  converter({
    id: "webp-to-jpg",
    slug: "webp-to-jpg",
    from: "webp",
    to: "jpg",
    title: "WEBP to JPG",
    description:
      "Convert WEBP images to JPG for tools, printers, and platforms that still expect JPEG input.",
    shortDescription: "Universal compatibility for older apps",
    metaDescription:
      "Convert WEBP to JPG online. Flatten transparency when needed and download JPEG files processed locally in your browser.",
    acceptExtensions: ".webp",
    outputLabel: "JPG",
    relatedSlugs: ["webp-to-png", "png-to-jpg", "jpg-to-webp"],
    faq: [
      BASE_FAQ_PRIVACY,
      {
        question: "Will transparent WEBP images work as JPG?",
        answer:
          "JPG cannot store transparency. Transparent areas are composited onto your chosen background colour before export.",
      },
    ],
  }),
  converter({
    id: "webp-to-png",
    slug: "webp-to-png",
    from: "webp",
    to: "png",
    title: "WEBP to PNG",
    description:
      "Convert WEBP images to PNG for editing pipelines, print handoffs, and tools that require lossless raster files.",
    shortDescription: "Lossless export for design tools",
    metaDescription:
      "Convert WEBP to PNG in your browser. Preserve transparency where supported and download PNG files instantly.",
    acceptExtensions: ".webp",
    outputLabel: "PNG",
    relatedSlugs: ["webp-to-jpg", "png-to-webp", "jpg-to-png"],
    faq: [BASE_FAQ_PRIVACY],
  }),
  converter({
    id: "heic-to-jpg",
    slug: "heic-to-jpg",
    from: "heic",
    to: "jpg",
    title: "HEIC to JPG",
    description:
      "Convert iPhone and Apple HEIC photos to JPG so you can share, upload, and edit them anywhere.",
    shortDescription: "Open Apple photos on any device",
    metaDescription:
      "Convert HEIC to JPG online. Turn iPhone photos into JPEG files with local browser processing and instant download.",
    acceptExtensions: ".heic,.heif",
    outputLabel: "JPG",
    badge: "Popular",
    relatedSlugs: ["heic-to-png", "png-to-jpg", "jpg-to-webp"],
    faq: [
      BASE_FAQ_PRIVACY,
      {
        question: "Why can't I open HEIC files on Windows?",
        answer:
          "HEIC is Apple's default capture format. Converting to JPG makes photos compatible with email, social platforms, and older software.",
      },
    ],
  }),
  converter({
    id: "heic-to-png",
    slug: "heic-to-png",
    from: "heic",
    to: "png",
    title: "HEIC to PNG",
    description:
      "Convert HEIC images to PNG for editing workflows that need a widely supported lossless format.",
    shortDescription: "Lossless export from iPhone photos",
    metaDescription:
      "Convert HEIC to PNG in your browser. Decode Apple HEIC photos locally and download PNG files ready for editing.",
    acceptExtensions: ".heic,.heif",
    outputLabel: "PNG",
    relatedSlugs: ["heic-to-jpg", "jpg-to-png", "png-to-jpg"],
    faq: [BASE_FAQ_PRIVACY],
  }),
];

export const IMAGE_HUB_FEATURED_MEDIUM = ["heic-to-jpg", "png-to-jpg", "jpg-to-webp"] as const;

export const IMAGE_HUB_EDIT_TOOLS: ImageHubTool[] = [
  {
    id: "background-remover",
    title: "Background Remover",
    description: "Remove backgrounds with on-device AI. HD free, 4K on Pro.",
    href: "/tools/background-remover",
    fileSupport: "PNG, JPG, WEBP",
    badge: "Premium",
    kind: "edit",
  },
  {
    id: "image-compressor",
    title: "Image Compressor",
    description: "Reduce image file size with adjustable quality.",
    href: "/tools/image-compressor",
    fileSupport: "JPG, PNG, WEBP, HEIC",
    kind: "edit",
  },
  {
    id: "image-resizer",
    title: "Image Resizer",
    description: "Resize images to exact pixel dimensions.",
    href: "/tools/image-resizer",
    fileSupport: "JPG, PNG, WEBP, HEIC",
    kind: "edit",
  },
  {
    id: "image-upscaler",
    title: "Image Upscaler",
    description: "Enlarge images 2× or 4× with Lanczos resampling.",
    href: "/tools/image-upscaler",
    fileSupport: "JPG, PNG, WEBP, HEIC",
    badge: "Premium",
    kind: "edit",
  },
  {
    id: "qr-scanner",
    title: "QR Scanner",
    description: "Scan codes from your camera or an uploaded image.",
    href: "/tools/qr-scanner",
    kind: "edit",
  },
];

export const IMAGE_HUB_PDF_RELATED: ImageHubTool[] = [
  {
    id: "image-to-pdf",
    title: "Image to PDF",
    description: "Build a PDF from JPG or PNG images.",
    href: "/tools/image-to-pdf",
    fileSupport: "JPG, PNG",
    kind: "pdf-related",
  },
  {
    id: "pdf-to-image",
    title: "PDF to Image",
    description: "Export PDF pages as JPG, PNG, or WEBP.",
    href: "/tools/pdf-to-image",
    fileSupport: "PDF",
    kind: "pdf-related",
  },
  {
    id: "ocr",
    title: "OCR",
    description: "Extract searchable text from scans and photos.",
    href: "/tools/ocr",
    kind: "pdf-related",
  },
];

export function getConverterBySlug(slug: string): ImageConverterDefinition | undefined {
  return IMAGE_CONVERTERS.find((item) => item.slug === slug);
}

export function getRelatedConverters(slug: string): ImageConverterDefinition[] {
  const current = getConverterBySlug(slug);
  if (!current) return [];
  return current.relatedSlugs
    .map((related) => getConverterBySlug(related))
    .filter((item): item is ImageConverterDefinition => item !== undefined);
}

export const IMAGE_TOOLS_HOMEPAGE_CHIPS = [
  "Background Remover",
  "PNG to JPG",
  "JPG to WEBP",
  "HEIC to JPG",
  "View all image tools",
] as const;
