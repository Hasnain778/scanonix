import { THRESHOLDS } from "@/lib/seo/local/constants";
import type {
  CannibalizationCandidate,
  QueryLandingMapRow,
} from "@/lib/seo/local/types";

export function detectCannibalization(
  queryPageRows: QueryLandingMapRow[],
): CannibalizationCandidate[] {
  const byQuery = new Map<string, QueryLandingMapRow[]>();

  for (const row of queryPageRows) {
    const existing = byQuery.get(row.query) ?? [];
    existing.push(row);
    byQuery.set(row.query, existing);
  }

  const candidates: CannibalizationCandidate[] = [];

  for (const [query, pages] of byQuery) {
    const meaningfulPages = pages.filter(
      (page) => page.impressions >= THRESHOLDS.minImpressionsPerUrlCannibalization,
    );

    if (meaningfulPages.length < 2) continue;

    const totalImpressions = meaningfulPages.reduce(
      (sum, page) => sum + page.impressions,
      0,
    );

    const signal: CannibalizationCandidate["signal"] =
      totalImpressions >= THRESHOLDS.minImpressionsCannibalization
        ? "REVIEW_CANDIDATE"
        : "EARLY_SIGNAL";

    candidates.push({
      query,
      signal,
      pages: meaningfulPages
        .sort((a, b) => b.impressions - a.impressions)
        .map((page) => ({
          page: page.landingPage,
          clicks: page.clicks,
          impressions: page.impressions,
          ctr: page.ctr,
          position: page.position,
        })),
      note:
        signal === "EARLY_SIGNAL"
          ? "Multiple URLs share impressions but total volume is low — not confirmed cannibalization."
          : "Multiple Scanonix URLs compete for the same query — human review recommended.",
    });
  }

  return candidates
    .sort((a, b) => {
      const aImp = a.pages.reduce((sum, p) => sum + p.impressions, 0);
      const bImp = b.pages.reduce((sum, p) => sum + p.impressions, 0);
      return bImp - aImp;
    })
    .slice(0, 25);
}
