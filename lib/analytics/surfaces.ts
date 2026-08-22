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
