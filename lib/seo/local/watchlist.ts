/**
 * Deterministic SEO watchlist (SEO-AUTO-3).
 * Explains WHY an item is watched — avoids noisy all-tools output.
 */

import { classifyEvidence } from "@/lib/seo/local/evidence";
import { getHoldForSlug, extractToolSlugFromPageUrl } from "@/lib/seo/local/holds";
import { classifyPositionBand } from "@/lib/seo/local/position-bands";
import { resolveRetiredEntry } from "@/lib/seo/local/retired-urls";
import type { SeoSnapshot } from "@/lib/seo/local/snapshots";
import { resolveSlugFromPageUrl } from "@/lib/seo/local/tool-seo-inspect";

export type WatchReasonCode =
  | "MEASUREMENT_HOLD"
  | "SPARSE_EVIDENCE"
  | "INSUFFICIENT_EVIDENCE"
  | "DEEP_RANKING_MONITOR"
  | "STRIKING_DISTANCE_MONITOR"
  | "READY_FOR_PROPOSAL_REVIEW";

export interface WatchlistItem {
  page: string;
  slug: string | null;
  reasonCode: WatchReasonCode;
  why: string;
  evidenceQuality: string;
  positionBand: string;
  impressions: number;
  position: number;
  urlLifecycle: "ACTIVE" | "RETIRED";
  measurementHold: boolean;
  readyForProposalReview: boolean;
  requiresHumanApproval: true;
}

function queriesForPage(snapshot: SeoSnapshot, page: string) {
  const slug = page.match(/\/tools\/([a-z0-9-]+)/i)?.[1]?.toLowerCase();
  return snapshot.queryPage
    .filter((row) => {
      const landing = row.landingPage.toLowerCase();
      if (slug && landing.includes(`/tools/${slug}`)) return true;
      return landing.replace(/\/$/, "") === page.replace(/\/$/, "").toLowerCase();
    })
    .map((row) => ({
      query: row.query,
      impressions: row.impressions,
      clicks: row.clicks,
      position: row.position,
      ctr: row.ctr,
    }));
}

/**
 * Build a concise watchlist from the latest snapshot.
 * Retired URLs are excluded from the active watchlist.
 */
export function buildWatchlistFromSnapshot(snapshot: SeoSnapshot): WatchlistItem[] {
  const items: WatchlistItem[] = [];

  for (const page of snapshot.pages) {
    if (!/\/tools\//i.test(page.key)) continue;
    const retired = resolveRetiredEntry(page.key);
    if (retired) continue;

    const slug =
      resolveSlugFromPageUrl(page.key) ??
      extractToolSlugFromPageUrl(page.key) ??
      null;
    const hold = slug ? getHoldForSlug(slug) : undefined;
    const evidence = classifyEvidence({
      pageImpressions: page.impressions,
      pageClicks: page.clicks,
      visibleQueries: queriesForPage(snapshot, page.key),
      windowDays: 28,
    });
    const band = classifyPositionBand(page.position);

    if (hold?.blocksActionableProposals) {
      items.push({
        page: page.key,
        slug,
        reasonCode: "MEASUREMENT_HOLD",
        why: `Measurement hold active (${hold.slug}): monitor performance only — do not propose production SEO edits.`,
        evidenceQuality: evidence.quality,
        positionBand: band,
        impressions: page.impressions,
        position: page.position,
        urlLifecycle: "ACTIVE",
        measurementHold: true,
        readyForProposalReview: false,
        requiresHumanApproval: true,
      });
      continue;
    }

    if (evidence.quality === "SPARSE") {
      items.push({
        page: page.key,
        slug,
        reasonCode: "SPARSE_EVIDENCE",
        why: "SPARSE query evidence — watch for stronger query×page coverage before content recommendations.",
        evidenceQuality: evidence.quality,
        positionBand: band,
        impressions: page.impressions,
        position: page.position,
        urlLifecycle: "ACTIVE",
        measurementHold: false,
        readyForProposalReview: false,
        requiresHumanApproval: true,
      });
      continue;
    }

    if (evidence.quality === "INSUFFICIENT") {
      // Only watch insufficient if impressions are non-zero emerging signal
      if (page.impressions > 0 && page.impressions < 10) {
        items.push({
          page: page.key,
          slug,
          reasonCode: "INSUFFICIENT_EVIDENCE",
          why: "Early/low impressions — watch only; not enough evidence for action.",
          evidenceQuality: evidence.quality,
          positionBand: band,
          impressions: page.impressions,
          position: page.position,
          urlLifecycle: "ACTIVE",
          measurementHold: false,
          readyForProposalReview: false,
          requiresHumanApproval: true,
        });
      }
      continue;
    }

    // STRONG evidence paths
    if (band === "DEEP" && page.impressions >= 100) {
      items.push({
        page: page.key,
        slug,
        reasonCode: "DEEP_RANKING_MONITOR",
        why: "STRONG evidence at DEEP positions — monitor for movement; proposal review only after hold/policy allows.",
        evidenceQuality: evidence.quality,
        positionBand: band,
        impressions: page.impressions,
        position: page.position,
        urlLifecycle: "ACTIVE",
        measurementHold: false,
        readyForProposalReview: true,
        requiresHumanApproval: true,
      });
      continue;
    }

    if (band === "STRIKING_DISTANCE" && page.impressions >= 50) {
      items.push({
        page: page.key,
        slug,
        reasonCode: "STRIKING_DISTANCE_MONITOR",
        why: "Meaningful impressions in striking distance — watch ranking/content/internal-link signals.",
        evidenceQuality: evidence.quality,
        positionBand: band,
        impressions: page.impressions,
        position: page.position,
        urlLifecycle: "ACTIVE",
        measurementHold: false,
        readyForProposalReview: evidence.quality === "STRONG",
        requiresHumanApproval: true,
      });
    }
  }

  return items.sort((a, b) => b.impressions - a.impressions);
}
