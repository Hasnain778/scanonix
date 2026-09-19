/**
 * Explicit measurement holds for SEO automation (SEO-AUTO-2).
 * Holds block actionable edit proposals; reporting/analysis remains allowed.
 */

export interface MeasurementHold {
  /** Tool slug / path segment (e.g. "ocr"). */
  slug: string;
  reason: string;
  /** When true, proposals for this page must be blocked for content/title edits. */
  blocksActionableProposals: true;
  /** ISO date when hold started (documentation only). */
  since?: string;
}

/**
 * Active holds — configure here rather than scattering magic conditions.
 * OCR is in a post-SEO-2A measurement period.
 */
export const MEASUREMENT_HOLDS: readonly MeasurementHold[] = [
  {
    slug: "ocr",
    reason:
      "OCR SEO baseline is in an active measurement period after the deployed H1/title change. Report and classify only — do not propose further title/H1/content edits until the hold is lifted.",
    blocksActionableProposals: true,
    since: "2026-03-01",
  },
] as const;

export function getHoldForSlug(slug: string): MeasurementHold | undefined {
  const normalized = slug.trim().toLowerCase();
  return MEASUREMENT_HOLDS.find((hold) => hold.slug === normalized);
}

export function getHoldForPageUrl(pageUrl: string): MeasurementHold | undefined {
  const slug = extractToolSlugFromPageUrl(pageUrl);
  return slug ? getHoldForSlug(slug) : undefined;
}

/** Extract canonical tool slug from a Scanonix tool URL or path. */
export function extractToolSlugFromPageUrl(pageUrl: string): string | undefined {
  try {
    const pathname = pageUrl.includes("://")
      ? new URL(pageUrl).pathname
      : pageUrl.split("?")[0] ?? pageUrl;
    const match = pathname.match(/\/tools\/([a-z0-9-]+)\/?$/i);
    return match?.[1]?.toLowerCase();
  } catch {
    const match = pageUrl.match(/\/tools\/([a-z0-9-]+)/i);
    return match?.[1]?.toLowerCase();
  }
}

export function isActionableProposalBlocked(slugOrPage: string): {
  blocked: boolean;
  hold?: MeasurementHold;
} {
  const hold =
    getHoldForSlug(slugOrPage) ?? getHoldForPageUrl(slugOrPage) ?? undefined;
  if (hold?.blocksActionableProposals) {
    return { blocked: true, hold };
  }
  return { blocked: false };
}
