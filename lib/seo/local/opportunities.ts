import { THRESHOLDS } from "@/lib/seo/local/constants";
import { classifyPositionBand } from "@/lib/seo/local/position-bands";
import type {
  OpportunityItem,
  SearchAnalyticsRow,
} from "@/lib/seo/local/types";

function signalForVolume(impressions: number): "EARLY_SIGNAL" | "ACTION_CANDIDATE" {
  return impressions >= THRESHOLDS.minImpressionsMeaningful
    ? "ACTION_CANDIDATE"
    : "EARLY_SIGNAL";
}

function isBrandQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return THRESHOLDS.brandTerms.some((term) => lower.includes(term));
}

/**
 * Append SEO-AUTO-2 position-band signals for pages.
 * TOP / STRIKING / EMERGING / DEEP are mutually exclusive categories.
 */
function pushPositionBandPageSignals(
  opportunities: OpportunityItem[],
  page: string,
  row: SearchAnalyticsRow,
  signal: "EARLY_SIGNAL" | "ACTION_CANDIDATE",
): void {
  const band = classifyPositionBand(row.position);

  if (band === "TOP") {
    if (
      row.impressions >= THRESHOLDS.highImpressionsFloor &&
      row.ctr < THRESHOLDS.lowCtrThreshold
    ) {
      opportunities.push({
        category: "TOP_LOW_CTR",
        signal,
        page,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        note: "TOP (1–10) with meaningful impressions and weak CTR — snippet/title review may be reasonable (not a deep-rank content overhaul).",
      });
    }
    return;
  }

  if (band === "STRIKING_DISTANCE" && row.impressions >= THRESHOLDS.minImpressionsMeaningful) {
    opportunities.push({
      category: "STRIKING_DISTANCE",
      signal,
      page,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      note: "STRIKING_DISTANCE (11–30) — ranking/content/internal-link opportunity; not equivalent to a top-10 CTR issue.",
    });
    return;
  }

  if (band === "EMERGING" && row.impressions >= THRESHOLDS.minImpressionsMeaningful) {
    opportunities.push({
      category: "EMERGING",
      signal,
      page,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      note: "EMERGING (31–60) — emerging relevance signal; confirm trend before copy changes.",
    });
    return;
  }

  if (
    band === "DEEP" &&
    row.impressions >= THRESHOLDS.deepRankingHighImpressionsFloor
  ) {
    opportunities.push({
      category: "DEEP_RANKING",
      signal,
      page,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      note: "DEEP_RANKING (61–100) with high impressions — Google sees relevance but page is far from competitive. Investigate intent/content/authority; do NOT treat as a position-7 CTR tweak.",
    });
  }
}

export function buildOpportunityReport(
  queryRows: SearchAnalyticsRow[],
  pageRows: SearchAnalyticsRow[],
): OpportunityItem[] {
  const opportunities: OpportunityItem[] = [];

  for (const row of queryRows) {
    const query = row.keys[0] ?? "";
    if (!query) continue;

    const signal = signalForVolume(row.impressions);

    if (
      row.impressions >= THRESHOLDS.highImpressionsFloor &&
      row.ctr < THRESHOLDS.lowCtrThreshold
    ) {
      opportunities.push({
        category: "HIGH_IMPRESSIONS_LOW_CTR",
        signal,
        query,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        note:
          signal === "EARLY_SIGNAL"
            ? "Low volume — treat as early signal, not a confirmed CTR problem."
            : "High impressions with below-average CTR — review title/meta alignment.",
      });
    }

    if (
      row.position >= THRESHOLDS.positionBandLow &&
      row.position <= THRESHOLDS.positionBandHigh
    ) {
      opportunities.push({
        category: "POSITION_4_15",
        signal,
        query,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        note: "Striking-distance query on page 1–2 border — monitor before changing copy.",
      });
    }

    if (
      row.position >= THRESHOLDS.positionBandMid &&
      row.position <= THRESHOLDS.positionBandExtended
    ) {
      opportunities.push({
        category: "POSITION_8_20",
        signal,
        query,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        note: "Page 2 territory — early signal unless impressions are meaningful.",
      });
    }

    if (row.impressions > 0 && row.clicks === 0) {
      opportunities.push({
        category: "ZERO_CLICK_QUERY",
        signal,
        query,
        clicks: 0,
        impressions: row.impressions,
        ctr: 0,
        position: row.position,
        note:
          row.impressions < THRESHOLDS.minImpressionsMeaningful
            ? "Very low impressions — not a confirmed zero-click problem."
            : "Query shows impressions but no clicks — review SERP snippet.",
      });
    }

    opportunities.push({
      category: isBrandQuery(query) ? "BRAND_QUERY" : "NON_BRAND_QUERY",
      signal,
      query,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      note: isBrandQuery(query)
        ? "Brand-intent query — expect higher CTR when volume grows."
        : "Non-brand query — primary organic growth signal.",
    });
  }

  for (const row of pageRows) {
    const page = row.keys[0] ?? "";
    if (!page) continue;

    const signal = signalForVolume(row.impressions);

    if (row.impressions > 0 && row.clicks === 0) {
      opportunities.push({
        category: "ZERO_CLICK_PAGE",
        signal,
        page,
        clicks: 0,
        impressions: row.impressions,
        ctr: 0,
        position: row.position,
        note:
          row.impressions < THRESHOLDS.minImpressionsMeaningful
            ? "Early signal only — insufficient volume."
            : "Page earns impressions but no clicks — review title/description in SERP.",
      });
    }

    if (
      row.impressions >= THRESHOLDS.highImpressionsFloor &&
      row.ctr < THRESHOLDS.lowCtrThreshold
    ) {
      const band = classifyPositionBand(row.position);
      opportunities.push({
        category: "HIGH_IMPRESSIONS_LOW_CTR_PAGE",
        signal,
        page,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        note:
          band === "DEEP"
            ? "High impressions + low CTR at DEEP position — prioritize intent/content review over snippet-only CTR fixes."
            : band === "TOP"
              ? "Page-level CTR opportunity in TOP band — compare with query→landing map for snippet/title review."
              : "Page-level CTR opportunity — interpret using position band; compare with query→landing map.",
      });
    }

    pushPositionBandPageSignals(opportunities, page, row, signal);
  }

  return dedupeOpportunities(opportunities)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 80);
}

function dedupeOpportunities(items: OpportunityItem[]): OpportunityItem[] {
  const seen = new Set<string>();
  const result: OpportunityItem[] = [];

  for (const item of items) {
    const key = `${item.category}|${item.query ?? ""}|${item.page ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

export function filterActionCandidates(items: OpportunityItem[]): OpportunityItem[] {
  return items.filter((item) => item.signal === "ACTION_CANDIDATE");
}

export function filterEarlySignals(items: OpportunityItem[]): OpportunityItem[] {
  return items.filter((item) => item.signal === "EARLY_SIGNAL");
}
