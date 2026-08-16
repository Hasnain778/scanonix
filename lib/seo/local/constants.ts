/** Local-only Search Console SEO tooling constants. Not for Next.js client bundles. */

/** Read-only Search Console scope — never request webmasters (write) here. */
export const GSC_READONLY_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export const GSC_READONLY_SCOPES = [GSC_READONLY_SCOPE] as const;

/** Canonical production origin (129B-FIX1). */
export const SEO_CANONICAL_ORIGIN = "https://www.scanonix.com";

export const SEO_SITEMAP_URL = `${SEO_CANONICAL_ORIGIN}/sitemap.xml`;

/** Default local credential paths (gitignored). */
export const DEFAULT_GSC_SECRETS_DIR = ".secrets/gsc";
export const DEFAULT_GSC_CLIENT_SECRET_FILENAME = "client_secret.json";
export const DEFAULT_GSC_TOKEN_FILENAME = "token.json";

/** Machine-readable report output (gitignored). */
export const DEFAULT_SEO_REPORT_DIR = ".tmp-seo";
export const DEFAULT_SEO_REPORT_FILENAME = "seo-report.json";

/** Minimum thresholds — low volume = EARLY SIGNAL, not SEO WIN/LOSS. */
export const THRESHOLDS = {
  /** Minimum impressions to treat a query/page row as meaningful. */
  minImpressionsMeaningful: 10,
  /** Minimum impressions for cannibalization candidate. */
  minImpressionsCannibalization: 20,
  /** Minimum impressions per URL in cannibalization group. */
  minImpressionsPerUrlCannibalization: 5,
  /** High-impression opportunity floor. */
  highImpressionsFloor: 50,
  /** Low CTR threshold (fraction) for high-impression pages. */
  lowCtrThreshold: 0.02,
  /** Position band: striking distance page 1 bottom. */
  positionBandLow: 4,
  positionBandMid: 8,
  positionBandHigh: 15,
  positionBandExtended: 20,
  /** Brand query detection (case-insensitive substring). */
  brandTerms: ["scanonix"],
} as const;

/** URL Inspection rate limit — conservative for 36-tool audit. */
export const URL_INSPECTION_DELAY_MS = 1100;

/** Max rows per Search Analytics API request. */
export const SEARCH_ANALYTICS_ROW_LIMIT = 25000;
