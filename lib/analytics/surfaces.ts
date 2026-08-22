/**
 * Low-cardinality GA4 source_surface values (Phase 130D Step 2B).
 */

export const ANALYTICS_SURFACES = {
  PRO_GATE: "pro_gate",
  SECURITY_GATE: "security_gate",
  USAGE_BANNER: "usage_banner",
  HOME_PRO_PROMO: "home_pro_promo",
  PRICING: "pricing",
  ACCOUNT_BILLING: "account_billing",
  TOOL_FINDER: "tool_finder",
  FEATURE_LOCK: "feature_lock",
} as const;

export type AnalyticsSurface = (typeof ANALYTICS_SURFACES)[keyof typeof ANALYTICS_SURFACES];

/** Fallback when checkout attribution metadata is missing or invalid. */
export const ANALYTICS_SOURCE_SURFACE_UNKNOWN = "unknown" as const;

/** Phase 130D frozen custom events (7) — preserved in 130E. */
export const FROZEN_130D_CUSTOM_EVENT_NAMES = [
  "tool_process_start",
  "tool_process_success",
  "tool_process_error",
  "tool_download",
  "upgrade_click",
  "checkout_start",
  "find_tool_search",
] as const;
