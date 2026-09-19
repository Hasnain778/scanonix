/**
 * Evidence-quality classification for Search Console rows (SEO-AUTO-2).
 * Distinguishes strong query visibility from sparse/anonymized query evidence.
 */

import { THRESHOLDS } from "@/lib/seo/local/constants";

export type EvidenceQuality = "STRONG" | "SPARSE" | "INSUFFICIENT";

export interface VisibleQueryRow {
  query: string;
  impressions: number;
  clicks?: number;
  position?: number;
  ctr?: number;
}

export interface EvidenceInput {
  /** Page-level impressions for the analysis window. */
  pageImpressions: number;
  /** Page-level clicks (optional context). */
  pageClicks?: number;
  /** Visible query rows attributed to this page (GSC may withhold many). */
  visibleQueries: VisibleQueryRow[];
  /** Analysis window length in days (e.g. 28). */
  windowDays: number;
}

export interface EvidenceAssessment {
  quality: EvidenceQuality;
  pageImpressions: number;
  visibleQueryCount: number;
  visibleQueryImpressions: number;
  /**
   * Ratio of summed visible-query impressions to page impressions.
   * Capped at 1. When low relative to page volume, GSC may be withholding
   * substantial query detail — we do NOT claim exact anonymized volume.
   */
  visibleQueryCoverageRatio: number | null;
  windowDays: number;
  notes: string[];
  /** Content-change recommendations should be blocked when true. */
  blocksContentChangeRecommendation: boolean;
}

function sumVisibleImpressions(queries: VisibleQueryRow[]): number {
  return queries.reduce((sum, row) => sum + Math.max(0, row.impressions), 0);
}

/**
 * Classify how trustworthy query-level evidence is for a page.
 *
 * Examples (conceptual):
 * - ~1630 page imp + many relevant visible queries → STRONG
 * - ~38 page imp + ~3 tiny visible query rows → SPARSE
 * - Very low page impressions → INSUFFICIENT
 */
export function classifyEvidence(input: EvidenceInput): EvidenceAssessment {
  const pageImpressions = Math.max(0, input.pageImpressions);
  const visibleQueries = input.visibleQueries.filter((q) => q.query.trim().length > 0);
  const visibleQueryCount = visibleQueries.length;
  const visibleQueryImpressions = sumVisibleImpressions(visibleQueries);
  const windowDays = Math.max(1, input.windowDays);

  const notes: string[] = [];

  if (windowDays < 14) {
    notes.push(
      `Short analysis window (${windowDays}d) — treat conclusions cautiously.`,
    );
  }

  const coverageRatio =
    pageImpressions > 0
      ? Math.min(1, visibleQueryImpressions / pageImpressions)
      : null;

  if (coverageRatio !== null && coverageRatio < 0.2 && pageImpressions >= THRESHOLDS.minImpressionsMeaningful) {
    notes.push(
      "Visible query impressions cover only a minority of page impressions; GSC may be withholding or anonymizing substantial query detail. Exact withheld volume is unknown.",
    );
  }

  // INSUFFICIENT — not enough page-level traffic to decide anything actionable
  if (pageImpressions < THRESHOLDS.minImpressionsMeaningful) {
    notes.push(
      `Page impressions (${pageImpressions}) below meaningful floor (${THRESHOLDS.minImpressionsMeaningful}).`,
    );
    return {
      quality: "INSUFFICIENT",
      pageImpressions,
      visibleQueryCount,
      visibleQueryImpressions,
      visibleQueryCoverageRatio: coverageRatio,
      windowDays,
      notes,
      blocksContentChangeRecommendation: true,
    };
  }

  const hasManyQueries = visibleQueryCount >= THRESHOLDS.evidenceStrongMinQueries;
  const hasDecentCoverage =
    coverageRatio !== null && coverageRatio >= THRESHOLDS.evidenceStrongMinCoverage;
  const hasStrongPageVolume = pageImpressions >= THRESHOLDS.highImpressionsFloor;

  // STRONG — page volume + enough visible query structure
  if (
    hasStrongPageVolume &&
    hasManyQueries &&
    (hasDecentCoverage || visibleQueryImpressions >= THRESHOLDS.evidenceStrongMinVisibleImp)
  ) {
    notes.push(
      "Page-level volume and visible query set are both meaningful enough for hypothesis formation (still requires human approval before any edit).",
    );
    return {
      quality: "STRONG",
      pageImpressions,
      visibleQueryCount,
      visibleQueryImpressions,
      visibleQueryCoverageRatio: coverageRatio,
      windowDays,
      notes,
      blocksContentChangeRecommendation: false,
    };
  }

  // Also STRONG when page volume is high and many queries even if coverage is moderate
  if (
    pageImpressions >= THRESHOLDS.evidenceStrongPageImpressions &&
    visibleQueryCount >= THRESHOLDS.evidenceStrongMinQueries
  ) {
    notes.push(
      "High page impressions with a broad visible query set — STRONG page signal; query coverage may still be incomplete.",
    );
    return {
      quality: "STRONG",
      pageImpressions,
      visibleQueryCount,
      visibleQueryImpressions,
      visibleQueryCoverageRatio: coverageRatio,
      windowDays,
      notes,
      blocksContentChangeRecommendation: false,
    };
  }

  // SPARSE — page has some impressions but query evidence is thin / anonymized
  const sparseByQueryCount =
    visibleQueryCount > 0 &&
    visibleQueryCount < THRESHOLDS.evidenceSparseMaxQueries;
  const sparseByCoverage =
    coverageRatio !== null &&
    coverageRatio < THRESHOLDS.evidenceSparseMaxCoverage &&
    pageImpressions >= THRESHOLDS.minImpressionsMeaningful;
  const sparseNoQueries = visibleQueryCount === 0 && pageImpressions >= THRESHOLDS.minImpressionsMeaningful;

  if (sparseNoQueries || sparseByQueryCount || sparseByCoverage) {
    notes.push(
      "Query-level evidence is sparse relative to page metrics — do not treat visible queries as a complete demand map. Content-change recommendations are blocked.",
    );
    return {
      quality: "SPARSE",
      pageImpressions,
      visibleQueryCount,
      visibleQueryImpressions,
      visibleQueryCoverageRatio: coverageRatio,
      windowDays,
      notes,
      blocksContentChangeRecommendation: true,
    };
  }

  // Mid-volume with moderate queries — still cautious (SPARSE unless clearly strong)
  notes.push(
    "Evidence sits between sparse and strong thresholds — defaulting to SPARSE to avoid over-confident content recommendations.",
  );
  return {
    quality: "SPARSE",
    pageImpressions,
    visibleQueryCount,
    visibleQueryImpressions,
    visibleQueryCoverageRatio: coverageRatio,
    windowDays,
    notes,
    blocksContentChangeRecommendation: true,
  };
}
