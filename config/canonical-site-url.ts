/** Canonical public origin for Scanonix (non-www). */
export const CANONICAL_SITE_ORIGIN = "https://scanonix.com";

const LOCAL_DEV_ORIGIN = "http://localhost:3000";

/**
 * Resolve the site URL used for SEO canonicals, sitemap, robots, and structured data.
 * Production scanonix.com / www.scanonix.com always normalizes to non-www.
 */
export function resolveCanonicalSiteUrl(rawUrl?: string): string {
  const trimmed = rawUrl?.trim().replace(/\/$/, "");

  if (!trimmed) {
    return process.env.NODE_ENV === "production" ? CANONICAL_SITE_ORIGIN : LOCAL_DEV_ORIGIN;
  }

  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);

    if (parsed.hostname === "scanonix.com" || parsed.hostname === "www.scanonix.com") {
      return CANONICAL_SITE_ORIGIN;
    }

    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return process.env.NODE_ENV === "production" ? CANONICAL_SITE_ORIGIN : LOCAL_DEV_ORIGIN;
  }
}
