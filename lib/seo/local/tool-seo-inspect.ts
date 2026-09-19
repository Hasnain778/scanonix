/**
 * Read-only TOOL_SEO inspection for proposal context (SEO-AUTO-2).
 * MUST NOT mutate constants/tool-seo.ts.
 */

import { TOOL_SEO, type ToolSeoEntry } from "@/constants/tool-seo";
import { extractToolSlugFromPageUrl } from "@/lib/seo/local/holds";

export interface ToolSeoSummary {
  slug: string;
  path: string;
  seoTitle: string;
  h1: string;
  metaDescriptionPresent: boolean;
  pageDescriptionPresent: boolean;
  headerDescriptionPresent: boolean;
  metaDescriptionLength: number;
  pageDescriptionLength: number;
  faqCount: number;
  relatedToolCount: number;
  keywordCount: number;
  hasHowTo: boolean;
  hasWhyUse: boolean;
  hasUseCases: boolean;
  hasLimitations: boolean;
}

function summarizeEntry(slug: string, entry: ToolSeoEntry): ToolSeoSummary {
  return {
    slug,
    path: entry.path,
    seoTitle: entry.seoTitle,
    h1: entry.h1,
    metaDescriptionPresent: Boolean(entry.metaDescription?.trim()),
    pageDescriptionPresent: Boolean(entry.pageDescription?.trim()),
    headerDescriptionPresent: Boolean(entry.headerDescription?.trim()),
    metaDescriptionLength: entry.metaDescription?.length ?? 0,
    pageDescriptionLength: entry.pageDescription?.length ?? 0,
    faqCount: entry.faqs?.length ?? 0,
    relatedToolCount: entry.relatedToolIds?.length ?? 0,
    keywordCount: entry.keywords?.length ?? 0,
    hasHowTo: (entry.howToSteps?.length ?? 0) > 0,
    hasWhyUse: (entry.whyUse?.length ?? 0) > 0,
    hasUseCases: (entry.useCases?.length ?? 0) > 0,
    hasLimitations: (entry.limitations?.length ?? 0) > 0,
  };
}

/** Inspect by tool slug. Returns null if not in TOOL_SEO. */
export function inspectToolSeoBySlug(slug: string): ToolSeoSummary | null {
  const entry = TOOL_SEO[slug];
  if (!entry) return null;
  return summarizeEntry(slug, entry);
}

/** Inspect by page URL or path. */
export function inspectToolSeoByPageUrl(pageUrl: string): ToolSeoSummary | null {
  const slug = extractToolSlugFromPageUrl(pageUrl);
  if (!slug) return null;
  return inspectToolSeoBySlug(slug);
}

/** Resolve slug for a page URL against TOOL_SEO paths. */
export function resolveSlugFromPageUrl(pageUrl: string): string | undefined {
  const fromPath = extractToolSlugFromPageUrl(pageUrl);
  if (fromPath && TOOL_SEO[fromPath]) return fromPath;

  try {
    const pathname = pageUrl.includes("://")
      ? new URL(pageUrl).pathname.replace(/\/$/, "")
      : pageUrl.split("?")[0]?.replace(/\/$/, "") ?? "";
    for (const [id, entry] of Object.entries(TOOL_SEO)) {
      if (entry.path.replace(/\/$/, "") === pathname) return id;
    }
  } catch {
    /* ignore */
  }
  return fromPath;
}
