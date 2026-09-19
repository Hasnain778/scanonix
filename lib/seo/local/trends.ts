/**
 * Impression trend detection across GSC windows (SEO-AUTO-2).
 */

import { THRESHOLDS } from "@/lib/seo/local/constants";
import type { SearchAnalyticsSummary } from "@/lib/seo/local/types";

export type TrendLabel = "RISING" | "FALLING" | "STABLE" | "UNCLEAR";

export interface TrendAssessment {
  label: TrendLabel;
  currentImpressions: number;
  previousImpressions: number;
  changeRatio: number | null;
  note: string;
}

/**
 * Compare current vs previous window summaries.
 * Avoids dramatic conclusions from tiny samples.
 */
export function detectTrend(
  current: Pick<SearchAnalyticsSummary, "impressions" | "clicks">,
  previous: Pick<SearchAnalyticsSummary, "impressions" | "clicks">,
): TrendAssessment {
  const currentImpressions = current.impressions;
  const previousImpressions = previous.impressions;
  const min = THRESHOLDS.trendMinImpressionsPerWindow;

  if (currentImpressions < min && previousImpressions < min) {
    return {
      label: "UNCLEAR",
      currentImpressions,
      previousImpressions,
      changeRatio: null,
      note: `Both windows below ${min} impressions — trend is UNCLEAR (early signal only).`,
    };
  }

  if (previousImpressions < min) {
    return {
      label: "UNCLEAR",
      currentImpressions,
      previousImpressions,
      changeRatio: null,
      note: `Previous window below ${min} impressions — cannot confirm a reliable trend.`,
    };
  }

  const changeRatio =
    (currentImpressions - previousImpressions) / previousImpressions;
  const threshold = THRESHOLDS.trendChangeRatio;

  if (changeRatio >= threshold) {
    return {
      label: "RISING",
      currentImpressions,
      previousImpressions,
      changeRatio,
      note: `Impressions up ~${(changeRatio * 100).toFixed(0)}% vs previous window — correlation only, not proven causality.`,
    };
  }

  if (changeRatio <= -threshold) {
    return {
      label: "FALLING",
      currentImpressions,
      previousImpressions,
      changeRatio,
      note: `Impressions down ~${(Math.abs(changeRatio) * 100).toFixed(0)}% vs previous window — investigate before concluding loss.`,
    };
  }

  return {
    label: "STABLE",
    currentImpressions,
    previousImpressions,
    changeRatio,
    note: "Impression change within noise threshold — treat as STABLE.",
  };
}

/** Page-level trend when only raw impression pairs are available. */
export function detectImpressionTrend(
  currentImpressions: number,
  previousImpressions: number,
): TrendAssessment {
  return detectTrend(
    { impressions: currentImpressions, clicks: 0 },
    { impressions: previousImpressions, clicks: 0 },
  );
}
