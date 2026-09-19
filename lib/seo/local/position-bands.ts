/**
 * Position-band classification (SEO-AUTO-2).
 * Bands are mutually exclusive and must not share recommendations.
 */

import {
  THRESHOLDS,
  type PositionBand,
} from "@/lib/seo/local/constants";

export type { PositionBand };

export function classifyPositionBand(position: number): PositionBand {
  if (!Number.isFinite(position) || position <= 0) {
    return "UNRANKED_OR_UNKNOWN";
  }
  if (position <= THRESHOLDS.positionTopMax) return "TOP";
  if (position <= THRESHOLDS.positionStrikingMax) return "STRIKING_DISTANCE";
  if (position <= THRESHOLDS.positionEmergingMax) return "EMERGING";
  if (position <= THRESHOLDS.positionDeepMax) return "DEEP";
  return "UNRANKED_OR_UNKNOWN";
}

export function positionBandGuidance(band: PositionBand): string {
  switch (band) {
    case "TOP":
      return "Positions 1–10: competitive SERP presence — poor CTR may warrant snippet/title review, not deep content overhauls by default.";
    case "STRIKING_DISTANCE":
      return "Positions 11–30: ranking/content/internal-link investigation may help; do not treat as a top-10 CTR-only problem.";
    case "EMERGING":
      return "Positions 31–60: emerging relevance — monitor trends and intent fit before aggressive copy changes.";
    case "DEEP":
      return "Positions 61–100: Google sees some relevance but the page is far from competitive — investigate intent/content/authority, NOT simple CTR tweaks.";
    default:
      return "Position unavailable or outside modeled bands — gather more evidence before recommending edits.";
  }
}
