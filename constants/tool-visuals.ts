/**
 * Central tool visual identity — single source for icon, accent, glow, and motion.
 * Covers all 36 canonical workspace tools (Phase 128F-FIX1).
 */

import { CANONICAL_TOOL_IDS } from "@/constants/tool-categories";

/** Semantic icon families — shared hues, individually distinguishable icons. */
export type ToolIconFamily =
  | "pdf-organize"
  | "pdf-convert"
  | "pdf-edit"
  | "pdf-optimize"
  | "pdf-security"
  | "image-edit"
  | "image-convert"
  | "ai"
  | "security";

/** Hover/focus micro-animation semantics. */
export type ToolIconMotion =
  | "merge"
  | "split"
  | "compress"
  | "rotate"
  | "organize"
  | "convert"
  | "protect"
  | "unlock"
  | "redact"
  | "sign"
  | "ai-sparkle"
  | "scan"
  | "resize"
  | "upscale"
  | "remove-bg"
  | "none";

export interface ToolVisualMeta {
  slug: string;
  /** Passed to ToolIcon — slug-specific or shared glyph id. */
  icon: string;
  iconFamily: ToolIconFamily;
  accentColor: string;
  glowColor: string;
  secondaryAccent?: string;
  motion: ToolIconMotion;
}

export const TOOL_VISUALS: Record<string, ToolVisualMeta> = {
  // PDF — Organize
  "merge-pdf": {
    slug: "merge-pdf",
    icon: "merge",
    iconFamily: "pdf-organize",
    accentColor: "#ff7a45",
    glowColor: "rgba(255, 122, 69, 0.22)",
    motion: "merge",
  },
  "split-pdf": {
    slug: "split-pdf",
    icon: "split",
    iconFamily: "pdf-organize",
    accentColor: "#ff8f5a",
    glowColor: "rgba(255, 143, 90, 0.22)",
    motion: "split",
  },
  "organize-pdf": {
    slug: "organize-pdf",
    icon: "organize-pdf",
    iconFamily: "pdf-organize",
    accentColor: "#ff6a00",
    glowColor: "rgba(255, 106, 0, 0.24)",
    motion: "organize",
  },
  "rotate-pdf": {
    slug: "rotate-pdf",
    icon: "rotate-pdf",
    iconFamily: "pdf-organize",
    accentColor: "#ff9f6b",
    glowColor: "rgba(255, 159, 107, 0.22)",
    motion: "rotate",
  },
  // PDF — Convert
  "pdf-to-word": {
    slug: "pdf-to-word",
    icon: "pdf-to-word",
    iconFamily: "pdf-convert",
    accentColor: "#60a5fa",
    glowColor: "rgba(96, 165, 250, 0.22)",
    secondaryAccent: "#3b82f6",
    motion: "convert",
  },
  "word-to-pdf": {
    slug: "word-to-pdf",
    icon: "word-to-pdf",
    iconFamily: "pdf-convert",
    accentColor: "#3b82f6",
    glowColor: "rgba(59, 130, 246, 0.22)",
    secondaryAccent: "#60a5fa",
    motion: "convert",
  },
  "pdf-to-image": {
    slug: "pdf-to-image",
    icon: "pdf-image",
    iconFamily: "pdf-convert",
    accentColor: "#818cf8",
    glowColor: "rgba(129, 140, 248, 0.22)",
    motion: "convert",
  },
  "image-to-pdf": {
    slug: "image-to-pdf",
    icon: "image-pdf",
    iconFamily: "pdf-convert",
    accentColor: "#6366f1",
    glowColor: "rgba(99, 102, 241, 0.22)",
    motion: "convert",
  },
  // PDF — Edit
  "fill-pdf": {
    slug: "fill-pdf",
    icon: "fill-pdf",
    iconFamily: "pdf-edit",
    accentColor: "#fb923c",
    glowColor: "rgba(251, 146, 60, 0.22)",
    motion: "none",
  },
  "crop-pdf": {
    slug: "crop-pdf",
    icon: "crop-pdf",
    iconFamily: "pdf-edit",
    accentColor: "#f97316",
    glowColor: "rgba(249, 115, 22, 0.22)",
    motion: "none",
  },
  "watermark-pdf": {
    slug: "watermark-pdf",
    icon: "watermark-pdf",
    iconFamily: "pdf-edit",
    accentColor: "#fdba74",
    glowColor: "rgba(253, 186, 116, 0.22)",
    motion: "none",
  },
  "add-page-numbers": {
    slug: "add-page-numbers",
    icon: "add-page-numbers",
    iconFamily: "pdf-edit",
    accentColor: "#ff8533",
    glowColor: "rgba(255, 133, 51, 0.22)",
    motion: "none",
  },
  "sign-pdf": {
    slug: "sign-pdf",
    icon: "sign-pdf",
    iconFamily: "pdf-edit",
    accentColor: "#ea580c",
    glowColor: "rgba(234, 88, 12, 0.22)",
    motion: "sign",
  },
  // PDF — Optimize
  "compress-pdf": {
    slug: "compress-pdf",
    icon: "compress",
    iconFamily: "pdf-optimize",
    accentColor: "#34d399",
    glowColor: "rgba(52, 211, 153, 0.22)",
    motion: "compress",
  },
  // PDF — Security
  "protect-pdf": {
    slug: "protect-pdf",
    icon: "protect-pdf",
    iconFamily: "pdf-security",
    accentColor: "#fbbf24",
    glowColor: "rgba(251, 191, 36, 0.22)",
    motion: "protect",
  },
  "unlock-pdf": {
    slug: "unlock-pdf",
    icon: "unlock-pdf",
    iconFamily: "pdf-security",
    accentColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.22)",
    motion: "unlock",
  },
  "redact-pdf": {
    slug: "redact-pdf",
    icon: "redact-pdf",
    iconFamily: "pdf-security",
    accentColor: "#ef4444",
    glowColor: "rgba(239, 68, 68, 0.2)",
    motion: "redact",
  },
  "metadata-cleaner": {
    slug: "metadata-cleaner",
    icon: "metadata-cleaner",
    iconFamily: "pdf-security",
    accentColor: "#10b981",
    glowColor: "rgba(16, 185, 129, 0.22)",
    motion: "none",
  },
  // Image
  "background-remover": {
    slug: "background-remover",
    icon: "bg-remove",
    iconFamily: "image-edit",
    accentColor: "#22d3ee",
    glowColor: "rgba(34, 211, 238, 0.22)",
    motion: "remove-bg",
  },
  "image-compressor": {
    slug: "image-compressor",
    icon: "image-compress",
    iconFamily: "image-edit",
    accentColor: "#2dd4bf",
    glowColor: "rgba(45, 212, 191, 0.22)",
    motion: "compress",
  },
  "image-resizer": {
    slug: "image-resizer",
    icon: "image-resize",
    iconFamily: "image-edit",
    accentColor: "#38bdf8",
    glowColor: "rgba(56, 189, 248, 0.22)",
    motion: "resize",
  },
  "image-upscaler": {
    slug: "image-upscaler",
    icon: "image-upscale",
    iconFamily: "image-edit",
    accentColor: "#0ea5e9",
    glowColor: "rgba(14, 165, 233, 0.22)",
    motion: "upscale",
  },
  "png-to-jpg": {
    slug: "png-to-jpg",
    icon: "png-to-jpg",
    iconFamily: "image-convert",
    accentColor: "#67e8f9",
    glowColor: "rgba(103, 232, 249, 0.2)",
    motion: "convert",
  },
  "jpg-to-png": {
    slug: "jpg-to-png",
    icon: "jpg-to-png",
    iconFamily: "image-convert",
    accentColor: "#7dd3fc",
    glowColor: "rgba(125, 211, 252, 0.2)",
    motion: "convert",
  },
  "png-to-webp": {
    slug: "png-to-webp",
    icon: "png-to-webp",
    iconFamily: "image-convert",
    accentColor: "#5eead4",
    glowColor: "rgba(94, 234, 212, 0.2)",
    motion: "convert",
  },
  "jpg-to-webp": {
    slug: "jpg-to-webp",
    icon: "jpg-to-webp",
    iconFamily: "image-convert",
    accentColor: "#6ee7b7",
    glowColor: "rgba(110, 231, 183, 0.2)",
    motion: "convert",
  },
  "webp-to-jpg": {
    slug: "webp-to-jpg",
    icon: "webp-to-jpg",
    iconFamily: "image-convert",
    accentColor: "#93c5fd",
    glowColor: "rgba(147, 197, 253, 0.2)",
    motion: "convert",
  },
  "webp-to-png": {
    slug: "webp-to-png",
    icon: "webp-to-png",
    iconFamily: "image-convert",
    accentColor: "#a5b4fc",
    glowColor: "rgba(165, 180, 252, 0.2)",
    motion: "convert",
  },
  "heic-to-jpg": {
    slug: "heic-to-jpg",
    icon: "heic-to-jpg",
    iconFamily: "image-convert",
    accentColor: "#fcd34d",
    glowColor: "rgba(252, 211, 77, 0.2)",
    motion: "convert",
  },
  "heic-to-png": {
    slug: "heic-to-png",
    icon: "heic-to-png",
    iconFamily: "image-convert",
    accentColor: "#fde68a",
    glowColor: "rgba(253, 230, 138, 0.2)",
    motion: "convert",
  },
  // AI
  ocr: {
    slug: "ocr",
    icon: "ocr",
    iconFamily: "ai",
    accentColor: "#a78bfa",
    glowColor: "rgba(167, 139, 250, 0.22)",
    motion: "scan",
  },
  "ai-translate": {
    slug: "ai-translate",
    icon: "ai-translate",
    iconFamily: "ai",
    accentColor: "#8b5cf6",
    glowColor: "rgba(139, 92, 246, 0.22)",
    motion: "ai-sparkle",
  },
  "ai-summary": {
    slug: "ai-summary",
    icon: "ai-summary",
    iconFamily: "ai",
    accentColor: "#c084fc",
    glowColor: "rgba(192, 132, 252, 0.22)",
    motion: "ai-sparkle",
  },
  "ai-rewrite": {
    slug: "ai-rewrite",
    icon: "ai-rewrite",
    iconFamily: "ai",
    accentColor: "#d946ef",
    glowColor: "rgba(217, 70, 239, 0.22)",
    motion: "ai-sparkle",
  },
  "qr-scanner": {
    slug: "qr-scanner",
    icon: "qr",
    iconFamily: "ai",
    accentColor: "#e879f9",
    glowColor: "rgba(232, 121, 249, 0.22)",
    motion: "scan",
  },
  // Security
  "security-scan": {
    slug: "security-scan",
    icon: "security",
    iconFamily: "security",
    accentColor: "#34d399",
    glowColor: "rgba(52, 211, 153, 0.22)",
    motion: "scan",
  },
};

export const TOOL_VISUAL_SLUGS = Object.keys(TOOL_VISUALS);

export function getToolVisual(slug: string): ToolVisualMeta | undefined {
  return TOOL_VISUALS[slug];
}

/** Resolve visual for a tool slug, falling back to generic PDF icon. */
export function resolveToolVisual(slug: string, fallbackIcon?: string): ToolVisualMeta {
  const existing = TOOL_VISUALS[slug];
  if (existing) return existing;

  return {
    slug,
    icon: fallbackIcon ?? "word",
    iconFamily: "pdf-edit",
    accentColor: "#ff6a00",
    glowColor: "rgba(255, 106, 0, 0.2)",
    motion: "none",
  };
}

/** Canonical coverage — must match CANONICAL_TOOL_IDS exactly. */
export function getMissingVisualSlugs(): string[] {
  return CANONICAL_TOOL_IDS.filter((id) => !TOOL_VISUALS[id]);
}

export function getDuplicateVisualSlugs(): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const slug of TOOL_VISUAL_SLUGS) {
    if (seen.has(slug)) duplicates.push(slug);
    seen.add(slug);
  }
  return duplicates;
}
