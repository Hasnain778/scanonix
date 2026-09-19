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
  /** Legacy position bands (striking-distance monitoring). */
  positionBandLow: 4,
  positionBandMid: 8,
  positionBandHigh: 15,
  positionBandExtended: 20,
  /** Brand query detection (case-insensitive substring). */
  brandTerms: ["scanonix"],

  /** SEO-AUTO-2 evidence quality. */
  evidenceStrongPageImpressions: 200,
  evidenceStrongMinQueries: 8,
  evidenceStrongMinCoverage: 0.15,
  evidenceStrongMinVisibleImp: 80,
  evidenceSparseMaxQueries: 5,
  evidenceSparseMaxCoverage: 0.12,

  /** SEO-AUTO-2 position bands (mutually exclusive primary band). */
  positionTopMax: 10,
  positionStrikingMax: 30,
  positionEmergingMax: 60,
  positionDeepMax: 100,

  /** Deep-ranking high-impression floor (distinct from top-10 CTR reviews). */
  deepRankingHighImpressionsFloor: 100,

  /** Trend detection — minimum impressions in each window. */
  trendMinImpressionsPerWindow: 20,
  /** Relative change threshold for rising/falling (fraction). */
  trendChangeRatio: 0.25,
} as const;

/** Position band labels (SEO-AUTO-2). */
export type PositionBand = "TOP" | "STRIKING_DISTANCE" | "EMERGING" | "DEEP" | "UNRANKED_OR_UNKNOWN";

/** Proposal / report artifact subdirs under .tmp-seo (gitignored). */
export const DEFAULT_SEO_PROPOSALS_DIR = "proposals";
export const DEFAULT_SEO_EXPERIMENTS_DIR = "experiments";
export const DEFAULT_SEO_PROPOSALS_LATEST = "latest.json";

/** SEO-AUTO-3 monitoring artifacts (gitignored under .tmp-seo). */
export const DEFAULT_SEO_SNAPSHOTS_DIR = "snapshots";
export const DEFAULT_SEO_MONITOR_DIR = "monitor";
export const DEFAULT_SEO_MONITOR_LATEST = "latest.json";
export const SEO_SNAPSHOT_SCHEMA_VERSION = 1 as const;

/**
 * Snapshot retention — only applies inside `.tmp-seo/snapshots/`.
 * Keep ~45 daily files (covers 7/14/28d comparisons + lag buffer).
 * Never deletes experiments/, proposals/, or seo-report.json.
 */
export const SNAPSHOT_RETENTION = {
  maxDailySnapshots: 45,
  /** Prefer keeping at least this many newest files even if older than window. */
  minKeep: 7,
} as const;

/** Change-detection thresholds (SEO-AUTO-3) — suppress tiny-sample noise. */
export const CHANGE_THRESHOLDS = {
  /** Both sides need this many impressions for most page change signals. */
  minImpressionsComparable: 20,
  /** Absolute impression delta for WATCH-level rise/drop. */
  impressionDeltaWatch: 40,
  /** Relative impression change for WATCH (fraction). */
  impressionDeltaWatchRatio: 0.35,
  /** Absolute impression delta for IMPORTANT. */
  impressionDeltaImportant: 100,
  /** Relative impression change for IMPORTANT. */
  impressionDeltaImportantRatio: 0.5,
  /** Baseline impressions floor for IMPORTANT impression moves. */
  impressionImportantBaselineMin: 40,
  /** Position improvement (lower is better) for WATCH — absolute positions. */
  positionImproveWatch: 5,
  /** Position improvement for IMPORTANT. */
  positionImproveImportant: 12,
  /** Position decline thresholds. */
  positionDeclineWatch: 5,
  positionDeclineImportant: 12,
  /** Min impressions for position signals. */
  positionSignalMinImpressions: 30,
  /** Click delta for WATCH / IMPORTANT. */
  clickDeltaWatch: 5,
  clickDeltaImportant: 15,
  /** CTR absolute change (fraction) for WATCH when impressions meaningful. */
  ctrDeltaWatch: 0.01,
  /** New/disappeared query min impressions. */
  queryAppearanceMinImpressions: 15,
  /** Expected GSC data lag (days) — informational; not a decline. */
  expectedGscLagDays: 3,
} as const;

/** URL Inspection rate limit — conservative for 36-tool audit. */
export const URL_INSPECTION_DELAY_MS = 1100;

/** Max rows per Search Analytics API request. */
export const SEARCH_ANALYTICS_ROW_LIMIT = 25000;
