/**
 * Snapshot change detection (SEO-AUTO-3).
 * Suppresses tiny-sample noise; refuses incomparable periods.
 */

import { CHANGE_THRESHOLDS, THRESHOLDS } from "@/lib/seo/local/constants";
import { resolveRetiredEntry } from "@/lib/seo/local/retired-urls";
import type { SeoSnapshot, SnapshotMetricRow } from "@/lib/seo/local/snapshots";

export type ChangeKind =
  | "IMPRESSION_RISE"
  | "IMPRESSION_DROP"
  | "POSITION_IMPROVEMENT"
  | "POSITION_DECLINE"
  | "NEW_QUERY"
  | "DISAPPEARED_QUERY"
  | "CLICK_GAIN"
  | "CLICK_LOSS"
  | "CTR_CHANGE";

export type AlertSeverity = "INFO" | "WATCH" | "IMPORTANT";

export type Comparability =
  | "COMPARABLE"
  | "INCOMPARABLE"
  | "INSUFFICIENT_HISTORY";

export interface DetectedChange {
  kind: ChangeKind;
  severity: AlertSeverity;
  subjectType: "page" | "query" | "site";
  subject: string;
  before?: { clicks: number; impressions: number; ctr: number; position: number };
  after?: { clicks: number; impressions: number; ctr: number; position: number };
  note: string;
  /** Retired residue never becomes an active optimization alert. */
  urlLifecycle: "ACTIVE" | "RETIRED";
  countsAsActiveAlert: boolean;
  readyForProposalReview: boolean;
  requiresHumanApproval: true;
}

export interface SnapshotComparisonResult {
  comparability: Comparability;
  comparabilityNote: string;
  earlier: { generatedAt: string; newestGscDataDate?: string };
  later: { generatedAt: string; newestGscDataDate?: string };
  changes: DetectedChange[];
}

function pageKey(url: string): string {
  try {
    if (url.includes("://")) return new URL(url).pathname.replace(/\/$/, "") || "/";
  } catch {
    /* ignore */
  }
  return (url.split("?")[0] ?? url).replace(/\/$/, "") || url;
}

function indexByKey(rows: SnapshotMetricRow[]): Map<string, SnapshotMetricRow> {
  const map = new Map<string, SnapshotMetricRow>();
  for (const row of rows) {
    if (!row.key) continue;
    map.set(pageKey(row.key), row);
  }
  return map;
}

function isToolPage(key: string): boolean {
  return /\/tools\//i.test(key);
}

/**
 * Check whether two snapshots share a comparable baseline window shape.
 * We require both to have newestGscDataDate and schemaVersion match.
 * Same newestGscDataDate with different generatedAt = same GSC window → weak compare (INFO only site).
 * Different newestGscDataDate = different available GSC data → comparable for monitoring.
 */
export function assessSnapshotComparability(
  earlier: SeoSnapshot,
  later: SeoSnapshot,
): { comparability: Comparability; note: string } {
  if (earlier.schemaVersion !== later.schemaVersion) {
    return {
      comparability: "INCOMPARABLE",
      note: "Snapshot schema versions differ — refuse comparison.",
    };
  }
  if (!earlier.siteBaseline || !later.siteBaseline) {
    return {
      comparability: "INCOMPARABLE",
      note: "Missing site baseline metrics.",
    };
  }
  if (!earlier.newestGscDataDate || !later.newestGscDataDate) {
    return {
      comparability: "INCOMPARABLE",
      note: "Missing newestGscDataDate — cannot align GSC windows safely.",
    };
  }
  if (earlier.contentHash === later.contentHash) {
    return {
      comparability: "INCOMPARABLE",
      note: "Identical metric content — no change to detect.",
    };
  }
  if (earlier.newestGscDataDate === later.newestGscDataDate) {
    return {
      comparability: "INCOMPARABLE",
      note: "Same newest GSC data date — snapshots reflect the same lagged window, not a new period. GSC lag is not an SEO decline.",
    };
  }
  // Prefer later > earlier by GSC data date
  if (later.newestGscDataDate < earlier.newestGscDataDate) {
    return {
      comparability: "INCOMPARABLE",
      note: "Later snapshot has an older GSC data date than earlier — refuse reversed comparison.",
    };
  }
  return {
    comparability: "COMPARABLE",
    note: `Comparing GSC windows ending ${earlier.newestGscDataDate} → ${later.newestGscDataDate}.`,
  };
}

function severityForImpressionDelta(
  beforeImp: number,
  afterImp: number,
): AlertSeverity | null {
  const abs = Math.abs(afterImp - beforeImp);
  const base = Math.max(beforeImp, 1);
  const ratio = abs / base;
  const t = CHANGE_THRESHOLDS;

  if (
    Math.min(beforeImp, afterImp) < t.minImpressionsComparable &&
    Math.max(beforeImp, afterImp) < t.minImpressionsComparable
  ) {
    return null;
  }

  if (
    abs >= t.impressionDeltaImportant &&
    ratio >= t.impressionDeltaImportantRatio &&
    beforeImp >= t.impressionImportantBaselineMin
  ) {
    return "IMPORTANT";
  }
  if (
    abs >= t.impressionDeltaWatch &&
    ratio >= t.impressionDeltaWatchRatio &&
    Math.max(beforeImp, afterImp) >= t.minImpressionsComparable
  ) {
    return "WATCH";
  }
  return null;
}

function severityForPositionDelta(
  beforePos: number,
  afterPos: number,
  impressions: number,
): { severity: AlertSeverity; improved: boolean } | null {
  const t = CHANGE_THRESHOLDS;
  if (impressions < t.positionSignalMinImpressions) return null;
  if (beforePos <= 0 || afterPos <= 0) return null;
  const delta = beforePos - afterPos; // positive = improvement
  const abs = Math.abs(delta);
  if (abs < t.positionImproveWatch) return null;
  if (abs >= t.positionImproveImportant) {
    return { severity: "IMPORTANT", improved: delta > 0 };
  }
  return { severity: "WATCH", improved: delta > 0 };
}

function lifecycleForSubject(subject: string, subjectType: string): {
  urlLifecycle: "ACTIVE" | "RETIRED";
  countsAsActiveAlert: boolean;
} {
  if (subjectType !== "page") {
    return { urlLifecycle: "ACTIVE", countsAsActiveAlert: true };
  }
  const retired = resolveRetiredEntry(subject);
  if (retired) {
    return { urlLifecycle: "RETIRED", countsAsActiveAlert: false };
  }
  return { urlLifecycle: "ACTIVE", countsAsActiveAlert: true };
}

function pushChange(
  changes: DetectedChange[],
  partial: Omit<DetectedChange, "requiresHumanApproval" | "urlLifecycle" | "countsAsActiveAlert" | "readyForProposalReview"> & {
    readyForProposalReview?: boolean;
  },
): void {
  const life = lifecycleForSubject(partial.subject, partial.subjectType);
  if (!life.countsAsActiveAlert) {
    // Still record as INFO visibility only — never IMPORTANT/WATCH optimization
    changes.push({
      ...partial,
      severity: "INFO",
      urlLifecycle: "RETIRED",
      countsAsActiveAlert: false,
      readyForProposalReview: false,
      requiresHumanApproval: true,
      note: `${partial.note} [RETIRED historical residue — not an active optimization alert]`,
    });
    return;
  }
  changes.push({
    ...partial,
    urlLifecycle: "ACTIVE",
    countsAsActiveAlert: true,
    readyForProposalReview: Boolean(partial.readyForProposalReview),
    requiresHumanApproval: true,
  });
}

export function detectChangesBetweenSnapshots(
  earlier: SeoSnapshot,
  later: SeoSnapshot,
): SnapshotComparisonResult {
  const assessment = assessSnapshotComparability(earlier, later);
  if (assessment.comparability !== "COMPARABLE") {
    return {
      comparability: assessment.comparability,
      comparabilityNote: assessment.note,
      earlier: {
        generatedAt: earlier.generatedAt,
        newestGscDataDate: earlier.newestGscDataDate,
      },
      later: {
        generatedAt: later.generatedAt,
        newestGscDataDate: later.newestGscDataDate,
      },
      changes: [],
    };
  }

  const changes: DetectedChange[] = [];
  const beforePages = indexByKey(earlier.pages);
  const afterPages = indexByKey(later.pages);
  const keys = new Set([...beforePages.keys(), ...afterPages.keys()]);

  for (const key of keys) {
    if (!isToolPage(key) && !key.includes("/tools/")) {
      // still allow if path looks like tools
      if (!/tools/i.test(key)) continue;
    }
    const before = beforePages.get(key);
    const after = afterPages.get(key);
    if (!before || !after) continue;

    const impSev = severityForImpressionDelta(before.impressions, after.impressions);
    if (impSev) {
      const rising = after.impressions > before.impressions;
      pushChange(changes, {
        kind: rising ? "IMPRESSION_RISE" : "IMPRESSION_DROP",
        severity: impSev,
        subjectType: "page",
        subject: after.key || before.key,
        before: {
          clicks: before.clicks,
          impressions: before.impressions,
          ctr: before.ctr,
          position: before.position,
        },
        after: {
          clicks: after.clicks,
          impressions: after.impressions,
          ctr: after.ctr,
          position: after.position,
        },
        note: rising
          ? `Impressions ${before.impressions} → ${after.impressions} (post-change observation, not proven causality).`
          : `Impressions ${before.impressions} → ${after.impressions} (investigate confounds; not proven causality).`,
        readyForProposalReview:
          impSev === "IMPORTANT" && rising && after.impressions >= CHANGE_THRESHOLDS.impressionImportantBaselineMin,
      });
    }

    const pos = severityForPositionDelta(
      before.position,
      after.position,
      Math.max(before.impressions, after.impressions),
    );
    if (pos) {
      pushChange(changes, {
        kind: pos.improved ? "POSITION_IMPROVEMENT" : "POSITION_DECLINE",
        severity: pos.severity,
        subjectType: "page",
        subject: after.key || before.key,
        before: {
          clicks: before.clicks,
          impressions: before.impressions,
          ctr: before.ctr,
          position: before.position,
        },
        after: {
          clicks: after.clicks,
          impressions: after.impressions,
          ctr: after.ctr,
          position: after.position,
        },
        note: pos.improved
          ? `Average position ${before.position.toFixed(1)} → ${after.position.toFixed(1)} (post-change signal only).`
          : `Average position ${before.position.toFixed(1)} → ${after.position.toFixed(1)} (decline signal; not proven causality).`,
        readyForProposalReview: false,
      });
    }

    const clickDelta = after.clicks - before.clicks;
    if (
      Math.abs(clickDelta) >= CHANGE_THRESHOLDS.clickDeltaWatch &&
      Math.max(before.impressions, after.impressions) >=
        CHANGE_THRESHOLDS.minImpressionsComparable
    ) {
      const sev: AlertSeverity =
        Math.abs(clickDelta) >= CHANGE_THRESHOLDS.clickDeltaImportant
          ? "IMPORTANT"
          : "WATCH";
      pushChange(changes, {
        kind: clickDelta > 0 ? "CLICK_GAIN" : "CLICK_LOSS",
        severity: sev,
        subjectType: "page",
        subject: after.key || before.key,
        before: {
          clicks: before.clicks,
          impressions: before.impressions,
          ctr: before.ctr,
          position: before.position,
        },
        after: {
          clicks: after.clicks,
          impressions: after.impressions,
          ctr: after.ctr,
          position: after.position,
        },
        note: `Clicks ${before.clicks} → ${after.clicks} (correlation only).`,
        readyForProposalReview: false,
      });
    }

    const ctrDelta = after.ctr - before.ctr;
    if (
      Math.abs(ctrDelta) >= CHANGE_THRESHOLDS.ctrDeltaWatch &&
      Math.max(before.impressions, after.impressions) >=
        THRESHOLDS.highImpressionsFloor
    ) {
      pushChange(changes, {
        kind: "CTR_CHANGE",
        severity: "WATCH",
        subjectType: "page",
        subject: after.key || before.key,
        before: {
          clicks: before.clicks,
          impressions: before.impressions,
          ctr: before.ctr,
          position: before.position,
        },
        after: {
          clicks: after.clicks,
          impressions: after.impressions,
          ctr: after.ctr,
          position: after.position,
        },
        note: `CTR ${(before.ctr * 100).toFixed(2)}% → ${(after.ctr * 100).toFixed(2)}% (snippet/intent watch).`,
        readyForProposalReview: false,
      });
    }
  }

  // Query appearance (top-query lists only — conservative)
  const beforeQ = indexByKey(earlier.queries);
  const afterQ = indexByKey(later.queries);
  for (const [q, row] of afterQ) {
    if (beforeQ.has(q)) continue;
    if (row.impressions < CHANGE_THRESHOLDS.queryAppearanceMinImpressions) continue;
    pushChange(changes, {
      kind: "NEW_QUERY",
      severity: "WATCH",
      subjectType: "query",
      subject: row.key,
      after: {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      },
      note: `New visible query in top list with ${row.impressions} impressions (may reflect GSC visibility, not true demand birth).`,
      readyForProposalReview: false,
    });
  }
  for (const [q, row] of beforeQ) {
    if (afterQ.has(q)) continue;
    if (row.impressions < CHANGE_THRESHOLDS.queryAppearanceMinImpressions) continue;
    pushChange(changes, {
      kind: "DISAPPEARED_QUERY",
      severity: "INFO",
      subjectType: "query",
      subject: row.key,
      before: {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      },
      note: `Query left top list (may be ranking shift or list churn — not automatically a loss).`,
      readyForProposalReview: false,
    });
  }

  changes.sort((a, b) => {
    const rank = { IMPORTANT: 0, WATCH: 1, INFO: 2 };
    return rank[a.severity] - rank[b.severity];
  });

  return {
    comparability: "COMPARABLE",
    comparabilityNote: assessment.note,
    earlier: {
      generatedAt: earlier.generatedAt,
      newestGscDataDate: earlier.newestGscDataDate,
    },
    later: {
      generatedAt: later.generatedAt,
      newestGscDataDate: later.newestGscDataDate,
    },
    changes,
  };
}