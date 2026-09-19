/**
 * SEO proposal engine — analysis artifacts only (SEO-AUTO-2).
 * Never mutates TOOL_SEO or production pages. Never performs git operations.
 */

import { classifyEvidence, type EvidenceAssessment } from "@/lib/seo/local/evidence";
import {
  extractToolSlugFromPageUrl,
  getHoldForSlug,
  type MeasurementHold,
} from "@/lib/seo/local/holds";
import {
  classifyPositionBand,
  positionBandGuidance,
  type PositionBand,
} from "@/lib/seo/local/position-bands";
import { clusterQueries, type QueryCluster } from "@/lib/seo/local/query-clusters";
import {
  detectTrend,
  type TrendAssessment,
  type TrendLabel,
} from "@/lib/seo/local/trends";
import {
  resolveRetiredEntry,
  type RetiredToolEntry,
} from "@/lib/seo/local/retired-urls";
import {
  inspectToolSeoBySlug,
  resolveSlugFromPageUrl,
  type ToolSeoSummary,
} from "@/lib/seo/local/tool-seo-inspect";
import type {
  CannibalizationCandidate,
  OpportunityItem,
  QueryLandingMapRow,
  SearchAnalyticsRow,
  SearchAnalyticsSummary,
  SeoReportPayload,
} from "@/lib/seo/local/types";

export type RecommendationType =
  | "OBSERVE"
  | "INTENT_REVIEW"
  | "CONTENT_REVIEW"
  | "INTERNAL_LINK_REVIEW"
  | "SNIPPET_REVIEW"
  | "CANNIBALIZATION_REVIEW"
  | "NO_ACTION"
  | "RETIRED_HISTORICAL";

export type UrlLifecycle = "ACTIVE" | "RETIRED";

export interface PageMetricsSnapshot {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SeoProposal {
  page: string;
  slug: string | null;
  generatedAt: string;
  evidenceQuality: EvidenceAssessment["quality"];
  evidence: EvidenceAssessment;
  pageMetrics: PageMetricsSnapshot;
  positionBand: PositionBand;
  positionGuidance: string;
  trend: TrendLabel;
  trendDetail: TrendAssessment | null;
  visibleQueries: Array<{
    query: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  }>;
  queryClusters: QueryCluster[];
  currentSeoSummary: ToolSeoSummary | null;
  detectedSignals: string[];
  recommendationType: RecommendationType;
  reasoning: string;
  confidenceNotes: string[];
  blocked: boolean;
  blockedReasons: string[];
  requiresHumanApproval: true;
  measurementHold: MeasurementHold | null;
  /** ACTIVE tool page vs intentionally retired historical residue. */
  urlLifecycle: UrlLifecycle;
  retired: RetiredToolEntry | null;
  /** False for retired residue — must not count as an active SEO opportunity. */
  countsAsActiveSeoCandidate: boolean;
}

export interface ProposalBundle {
  generatedAt: string;
  source: "seo-report" | "fixture" | "live";
  oauthScopeExpected: "https://www.googleapis.com/auth/webmasters.readonly";
  writeAccessRequested: false;
  requiresHumanApproval: true;
  mutatesToolSeo: false;
  gitOperations: false;
  proposals: SeoProposal[];
  /** Convenience counts — retired residue is listed but not an optimization queue. */
  activeCandidateCount: number;
  retiredResidueCount: number;
}

const ACTIONABLE_TYPES: RecommendationType[] = [
  "INTENT_REVIEW",
  "CONTENT_REVIEW",
  "INTERNAL_LINK_REVIEW",
  "SNIPPET_REVIEW",
  "CANNIBALIZATION_REVIEW",
];

function pagePathKey(url: string): string {
  try {
    if (url.includes("://")) {
      return new URL(url).pathname.replace(/\/$/, "") || "/";
    }
  } catch {
    /* fall through */
  }
  return url.split("?")[0]?.replace(/\/$/, "") || url;
}

function queriesForPage(
  page: string,
  map: QueryLandingMapRow[],
): QueryLandingMapRow[] {
  const key = pagePathKey(page);
  return map.filter((row) => pagePathKey(row.landingPage) === key);
}

function pickRecommendation(args: {
  band: PositionBand;
  evidence: EvidenceAssessment;
  signals: string[];
  hold: MeasurementHold | undefined;
  sparseBlocks: boolean;
}): { type: RecommendationType; reasoning: string; blocked: boolean; blockedReasons: string[] } {
  const blockedReasons: string[] = [];
  let blocked = false;

  if (args.hold?.blocksActionableProposals) {
    blocked = true;
    blockedReasons.push(`Measurement hold active for "${args.hold.slug}": ${args.hold.reason}`);
  }

  if (args.sparseBlocks || args.evidence.blocksContentChangeRecommendation) {
    if (args.evidence.quality !== "STRONG") {
      blocked = true;
      blockedReasons.push(
        `Evidence quality is ${args.evidence.quality} — content-change recommendations are blocked until query evidence improves.`,
      );
    }
  }

  if (args.evidence.quality === "INSUFFICIENT") {
    return {
      type: "OBSERVE",
      reasoning:
        "Insufficient page-level evidence for an actionable SEO investigation. Continue monitoring.",
      blocked: true,
      blockedReasons: [
        ...blockedReasons,
        "INSUFFICIENT evidence — observe only.",
      ],
    };
  }

  // Prefer band-appropriate recommendation types
  let type: RecommendationType = "OBSERVE";
  let reasoning = positionBandGuidance(args.band);

  if (args.signals.includes("CANNIBALIZATION_REVIEW")) {
    type = "CANNIBALIZATION_REVIEW";
    reasoning =
      "Multiple Scanonix URLs appear for overlapping queries — human cannibalization review recommended before consolidating intent.";
  } else if (args.band === "TOP" && args.signals.includes("TOP_LOW_CTR")) {
    type = "SNIPPET_REVIEW";
    reasoning =
      "TOP-band page with weak CTR relative to impressions — investigate title/meta SERP snippet alignment. Do not invent keyword-stuffed replacements.";
  } else if (args.band === "STRIKING_DISTANCE") {
    type = "INTERNAL_LINK_REVIEW";
    reasoning =
      "STRIKING_DISTANCE (11–30) — investigate ranking factors, internal links, and content depth. Not a top-10 CTR-only problem.";
  } else if (args.band === "EMERGING") {
    type = "INTENT_REVIEW";
    reasoning =
      "EMERGING (31–60) — review whether page intent/naming matches visible queries before editing copy.";
  } else if (args.band === "DEEP" && args.signals.includes("DEEP_RANKING")) {
    type = "CONTENT_REVIEW";
    reasoning =
      "DEEP_RANKING with high impressions — Google associates the page with queries but rankings are far from competitive. Investigate intent fit, content substance, and authority signals — NOT a position-7 CTR tweak.";
  } else if (args.signals.includes("ZERO_CLICK_PAGE") && args.band === "TOP") {
    type = "SNIPPET_REVIEW";
    reasoning = "Page earns impressions with zero clicks in TOP band — SERP snippet review.";
  } else if (args.evidence.quality === "SPARSE") {
    type = "OBSERVE";
    reasoning =
      "Page metrics exist but visible query evidence is sparse/anonymized — observe and gather stronger query×page evidence before content changes.";
  } else {
    type = "NO_ACTION";
    reasoning = "No clear band-specific action signal beyond continued monitoring.";
  }

  if (blocked && ACTIONABLE_TYPES.includes(type)) {
    return {
      type: "OBSERVE",
      reasoning: `${reasoning} Actionable recommendation blocked — downgraded to OBSERVE.`,
      blocked: true,
      blockedReasons,
    };
  }

  if (blocked) {
    return { type: "OBSERVE", reasoning, blocked: true, blockedReasons };
  }

  return { type, reasoning, blocked: false, blockedReasons };
}

export interface BuildProposalsOptions {
  generatedAt?: string;
  source?: ProposalBundle["source"];
  windowDays?: number;
  siteTrend?: {
    current: SearchAnalyticsSummary;
    previous: SearchAnalyticsSummary;
  } | null;
}

export function buildProposalsFromReport(
  report: SeoReportPayload,
  options: BuildProposalsOptions = {},
): ProposalBundle {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const windowDays = options.windowDays ?? 28;
  const pageRows = report.baseline?.topPages ?? [];
  // Prefer full page list from opportunities / map; also scan queryLandingMap pages
  const pageMetrics = new Map<string, PageMetricsSnapshot & { page: string }>();

  for (const row of pageRows) {
    const page = row.keys[0];
    if (!page) continue;
    pageMetrics.set(pagePathKey(page), {
      page,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    });
  }

  // Include pages that appear in query landing map but not top pages
  for (const row of report.queryLandingMap) {
    const key = pagePathKey(row.landingPage);
    if (!pageMetrics.has(key)) {
      pageMetrics.set(key, {
        page: row.landingPage,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      });
    } else {
      // Aggregate if map has more complete per-page rollup needed — keep topPages metrics as authority
    }
  }

  // Also pull pages from opportunity items
  for (const item of report.opportunities) {
    if (!item.page) continue;
    const key = pagePathKey(item.page);
    if (!pageMetrics.has(key)) {
      pageMetrics.set(key, {
        page: item.page,
        clicks: item.clicks,
        impressions: item.impressions,
        ctr: item.ctr,
        position: item.position,
      });
    }
  }

  const siteTrend = options.siteTrend
    ? detectTrend(options.siteTrend.current, options.siteTrend.previous)
    : report.comparison7d
      ? detectTrend(report.comparison7d.current, report.comparison7d.previous)
      : null;

  const proposals: SeoProposal[] = [];

  for (const metrics of pageMetrics.values()) {
    // Focus on tool pages
    if (!/\/tools\//i.test(metrics.page)) continue;

    const slug =
      resolveSlugFromPageUrl(metrics.page) ??
      extractToolSlugFromPageUrl(metrics.page) ??
      null;

    const visibleMapRows = queriesForPage(metrics.page, report.queryLandingMap);
    const visibleQueries = visibleMapRows.map((row) => ({
      query: row.query,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: row.ctr,
      position: row.position,
    }));

    // If map empty, try matching query-level opportunities is not page-specific — leave empty
    const evidence = classifyEvidence({
      pageImpressions: metrics.impressions,
      pageClicks: metrics.clicks,
      visibleQueries,
      windowDays,
    });

    const band = classifyPositionBand(metrics.position);
    const clusters = clusterQueries(visibleQueries);
    const seoSummary = slug ? inspectToolSeoBySlug(slug) : null;
    const hold = slug ? getHoldForSlug(slug) : undefined;
    const retired = resolveRetiredEntry(metrics.page, slug);

    // Intentionally retired URLs: report for visibility only — never optimize.
    if (retired) {
      proposals.push({
        page: metrics.page,
        slug: slug ?? retired.slug,
        generatedAt,
        evidenceQuality: evidence.quality,
        evidence,
        pageMetrics: {
          clicks: metrics.clicks,
          impressions: metrics.impressions,
          ctr: metrics.ctr,
          position: metrics.position,
        },
        positionBand: band,
        positionGuidance:
          "Historical GSC position for an intentionally retired URL is not a current SEO opportunity. Do not interpret TOP/STRIKING/EMERGING/DEEP bands as optimization signals for retired residue.",
        trend: siteTrend?.label ?? "UNCLEAR",
        trendDetail: siteTrend,
        visibleQueries: visibleQueries
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 25),
        queryClusters: clusters.slice(0, 10),
        currentSeoSummary: seoSummary,
        detectedSignals: ["RETIRED_HISTORICAL_RESIDUE"],
        recommendationType: "RETIRED_HISTORICAL",
        reasoning: `${retired.reason} Impressions/position here are search residue after retirement — not a win to build on and not a candidate for title/H1/content/snippet/internal-link review.`,
        confidenceNotes: [
          "Intentionally retired URL — explicit registry match only (unknown 404s are not auto-suppressed).",
          "Historical average position must not be treated as a live TOP opportunity.",
          "Proposals never promise rankings and never auto-edit production SEO.",
        ],
        blocked: true,
        blockedReasons: [
          `Retired tool URL (${retired.path}): historical GSC residue — excluded from active SEO optimization proposals.`,
        ],
        requiresHumanApproval: true,
        measurementHold: hold ?? null,
        urlLifecycle: "RETIRED",
        retired,
        countsAsActiveSeoCandidate: false,
      });
      continue;
    }

    const pageSignals = report.opportunities
      .filter((o) => o.page && pagePathKey(o.page) === pagePathKey(metrics.page))
      .map((o) => o.category);

    const cannibal = report.cannibalization.filter((c) =>
      c.pages.some((p) => pagePathKey(p.page) === pagePathKey(metrics.page)),
    );
    if (cannibal.some((c) => c.signal === "REVIEW_CANDIDATE")) {
      pageSignals.push("CANNIBALIZATION_REVIEW");
    }

    // Ensure DEEP_RANKING signal present when band + volume warrant
    if (
      band === "DEEP" &&
      metrics.impressions >= 100 &&
      !pageSignals.includes("DEEP_RANKING")
    ) {
      pageSignals.push("DEEP_RANKING");
    }
    if (
      band === "TOP" &&
      metrics.impressions >= 50 &&
      metrics.ctr < 0.02 &&
      !pageSignals.includes("TOP_LOW_CTR")
    ) {
      pageSignals.push("TOP_LOW_CTR");
    }

    const rec = pickRecommendation({
      band,
      evidence,
      signals: pageSignals,
      hold,
      sparseBlocks: evidence.blocksContentChangeRecommendation,
    });

    const confidenceNotes = [
      ...evidence.notes,
      ...(siteTrend ? [`Site-level 7d trend: ${siteTrend.label} — ${siteTrend.note}`] : []),
      "Proposals never promise rankings and never auto-edit production SEO.",
    ];

    proposals.push({
      page: metrics.page,
      slug,
      generatedAt,
      evidenceQuality: evidence.quality,
      evidence,
      pageMetrics: {
        clicks: metrics.clicks,
        impressions: metrics.impressions,
        ctr: metrics.ctr,
        position: metrics.position,
      },
      positionBand: band,
      positionGuidance: positionBandGuidance(band),
      trend: siteTrend?.label ?? "UNCLEAR",
      trendDetail: siteTrend,
      visibleQueries: visibleQueries
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 25),
      queryClusters: clusters.slice(0, 10),
      currentSeoSummary: seoSummary,
      detectedSignals: [...new Set(pageSignals)],
      recommendationType: rec.type,
      reasoning: rec.reasoning,
      confidenceNotes,
      blocked: rec.blocked,
      blockedReasons: rec.blockedReasons,
      requiresHumanApproval: true,
      measurementHold: hold ?? null,
      urlLifecycle: "ACTIVE",
      retired: null,
      countsAsActiveSeoCandidate: true,
    });
  }

  proposals.sort(
    (a, b) => b.pageMetrics.impressions - a.pageMetrics.impressions,
  );

  const retiredResidueCount = proposals.filter((p) => p.urlLifecycle === "RETIRED").length;
  const activeCandidateCount = proposals.filter((p) => p.countsAsActiveSeoCandidate).length;

  return {
    generatedAt,
    source: options.source ?? "seo-report",
    oauthScopeExpected: "https://www.googleapis.com/auth/webmasters.readonly",
    writeAccessRequested: false,
    requiresHumanApproval: true,
    mutatesToolSeo: false,
    gitOperations: false,
    proposals,
    activeCandidateCount,
    retiredResidueCount,
  };
}

/** Build a synthetic SeoReportPayload fragment for fixture-based proposals. */
export function buildFixtureReport(input: {
  pages: SearchAnalyticsRow[];
  queryPageMap: QueryLandingMapRow[];
  opportunities?: OpportunityItem[];
  cannibalization?: CannibalizationCandidate[];
  comparison7d?: SeoReportPayload["comparison7d"];
}): SeoReportPayload {
  return {
    generatedAt: new Date().toISOString(),
    status: "CONNECTED",
    oauthScope: "https://www.googleapis.com/auth/webmasters.readonly",
    writeAccessRequested: false,
    baseline: {
      period: "fixture",
      clicks: input.pages.reduce((s, p) => s + p.clicks, 0),
      impressions: input.pages.reduce((s, p) => s + p.impressions, 0),
      ctr: 0,
      position: 0,
      topQueries: [],
      topPages: input.pages,
    },
    comparison7d: input.comparison7d,
    opportunities: input.opportunities ?? [],
    queryLandingMap: input.queryPageMap,
    cannibalization: input.cannibalization ?? [],
    sitemap: { notes: ["fixture"] },
    indexingFindings: [],
  };
}
