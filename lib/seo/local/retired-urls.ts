/**
 * Intentionally retired Scanonix tool URLs (SEO-AUTO-2.1).
 *
 * Historical GSC impressions for these paths are search residue after product
 * retirement — NOT current optimization candidates.
 *
 * Do NOT use this registry to suppress arbitrary unknown 404s; those may be
 * real defects and must remain visible for investigation.
 */

import { extractToolSlugFromPageUrl } from "@/lib/seo/local/holds";

export interface RetiredToolEntry {
  /** Canonical path without trailing slash, e.g. "/tools/background-remover". */
  path: string;
  /** Tool slug when applicable. */
  slug: string;
  reason: string;
  /** Optional documentation date (ISO). */
  retiredSince?: string;
}

/**
 * Explicit allowlist of intentionally retired public tool URLs.
 * Add entries here when a tool is deliberately removed from the product.
 */
export const RETIRED_TOOL_ENTRIES: readonly RetiredToolEntry[] = [
  {
    path: "/tools/background-remover",
    slug: "background-remover",
    reason:
      "Background Remover was intentionally retired from Scanonix; the production route returns 404. Remaining GSC impressions are historical search residue, not a live tool to optimize.",
    retiredSince: "2026-01-01",
  },
] as const;

function normalizePathname(pageUrlOrPath: string): string {
  try {
    const raw = pageUrlOrPath.includes("://")
      ? new URL(pageUrlOrPath).pathname
      : pageUrlOrPath.split("?")[0] ?? pageUrlOrPath;
    const path = raw.replace(/\/+$/, "") || "/";
    return path.toLowerCase();
  } catch {
    return (pageUrlOrPath.split("?")[0] ?? pageUrlOrPath)
      .replace(/\/+$/, "")
      .toLowerCase();
  }
}

export function getRetiredEntryForPath(
  pageUrlOrPath: string,
): RetiredToolEntry | undefined {
  const path = normalizePathname(pageUrlOrPath);
  return RETIRED_TOOL_ENTRIES.find((entry) => entry.path === path);
}

export function getRetiredEntryForSlug(slug: string): RetiredToolEntry | undefined {
  const normalized = slug.trim().toLowerCase();
  return RETIRED_TOOL_ENTRIES.find((entry) => entry.slug === normalized);
}

/** True only for explicitly registered retired tools — never inferred from HTTP status. */
export function isIntentionallyRetiredUrl(pageUrlOrPath: string): boolean {
  return Boolean(getRetiredEntryForPath(pageUrlOrPath));
}

export function isIntentionallyRetiredSlug(slug: string): boolean {
  return Boolean(getRetiredEntryForSlug(slug));
}

/**
 * Resolve retired entry from URL or slug.
 * Unknown /tools/* paths are NOT retired by default.
 */
export function resolveRetiredEntry(
  pageUrlOrPath: string,
  slug?: string | null,
): RetiredToolEntry | undefined {
  const byPath = getRetiredEntryForPath(pageUrlOrPath);
  if (byPath) return byPath;
  if (slug) return getRetiredEntryForSlug(slug);
  const extracted = extractToolSlugFromPageUrl(pageUrlOrPath);
  return extracted ? getRetiredEntryForSlug(extracted) : undefined;
}
