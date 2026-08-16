import { THRESHOLDS } from "@/lib/seo/local/constants";
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
      opportunities.push({
        category: "HIGH_IMPRESSIONS_LOW_CTR_PAGE",
        signal,
        page,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        note: "Page-level CTR opportunity — compare with query→landing map.",
      });
    }
  }

  return dedupeOpportunities(opportunities)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50);
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
