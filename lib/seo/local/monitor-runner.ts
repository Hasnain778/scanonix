/**
 * SEO monitor runner (SEO-AUTO-3) — local read-only change detection.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHANGE_THRESHOLDS,
  DEFAULT_SEO_MONITOR_DIR,
  DEFAULT_SEO_MONITOR_LATEST,
  DEFAULT_SEO_REPORT_DIR,
  GSC_READONLY_SCOPE,
} from "@/lib/seo/local/constants";
import {
  detectChangesBetweenSnapshots,
  type AlertSeverity,
  type DetectedChange,
  type SnapshotComparisonResult,
} from "@/lib/seo/local/change-detection";
import { evaluateAllCheckpoints } from "@/lib/seo/local/experiment-checkpoints";
import { listExperiments } from "@/lib/seo/local/experiments";
import { MEASUREMENT_HOLDS } from "@/lib/seo/local/holds";
import { RETIRED_TOOL_ENTRIES } from "@/lib/seo/local/retired-urls";
import {
  importLatestReportAsSnapshot,
  listSnapshots,
  type SeoSnapshot,
} from "@/lib/seo/local/snapshots";
import { buildWatchlistFromSnapshot, type WatchlistItem } from "@/lib/seo/local/watchlist";

export interface DataFreshness {
  generatedAt: string;
  newestGscDataDate?: string;
  gscLagDays: number | null;
  expectedLagDays: number;
  note: string;
}

export interface MonitorReport {
  generatedAt: string;
  status: "OK" | "INSUFFICIENT_HISTORY" | "NO_DATA";
  oauthScopeExpected: typeof GSC_READONLY_SCOPE;
  writeAccessRequested: false;
  mutatesToolSeo: false;
  gitOperations: false;
  requiresHumanApproval: true;
  dataFreshness: DataFreshness | null;
  comparison: SnapshotComparisonResult | null;
  importantChanges: DetectedChange[];
  watchChanges: DetectedChange[];
  infoChanges: DetectedChange[];
  watchlist: WatchlistItem[];
  measurementHolds: Array<{ slug: string; reason: string }>;
  retiredResidue: Array<{ path: string; slug: string; reason: string }>;
  experimentCheckpoints: ReturnType<typeof evaluateAllCheckpoints>[];
  notes: string[];
}

function pickComparisonPair(snapshots: SeoSnapshot[]): {
  earlier: SeoSnapshot;
  later: SeoSnapshot;
} | null {
  if (snapshots.length < 2) return null;
  // Prefer newest vs oldest-with-different-gsc-date
  const later = snapshots[snapshots.length - 1]!;
  for (let i = snapshots.length - 2; i >= 0; i--) {
    const earlier = snapshots[i]!;
    const result = detectChangesBetweenSnapshots(earlier, later);
    if (result.comparability === "COMPARABLE") {
      return { earlier, later };
    }
  }
  // Fall back to adjacent pair for messaging
  return {
    earlier: snapshots[snapshots.length - 2]!,
    later,
  };
}

function freshnessFromSnapshot(snapshot: SeoSnapshot): DataFreshness {
  const lag = snapshot.gscLagDays ?? null;
  return {
    generatedAt: snapshot.generatedAt,
    newestGscDataDate: snapshot.newestGscDataDate,
    gscLagDays: lag,
    expectedLagDays: CHANGE_THRESHOLDS.expectedGscLagDays,
    note:
      lag === null
        ? "GSC lag could not be determined from snapshot periods."
        : lag <= CHANGE_THRESHOLDS.expectedGscLagDays + 1
          ? `Newest GSC data date lags ~${lag} day(s) behind report generation — expected Search Console delay, not an SEO decline.`
          : `Newest GSC data date lags ~${lag} day(s). Missing newest calendar days are GSC delay, not ranking loss.`,
  };
}

export function runSeoMonitor(options: { cwd?: string } = {}): MonitorReport {
  const cwd = options.cwd ?? process.cwd();
  const generatedAt = new Date().toISOString();
  const notes: string[] = [];

  // Ensure latest convenience report is imported into snapshot history (deduped).
  const imported = importLatestReportAsSnapshot(cwd);
  notes.push(`Snapshot import: ${imported.reason}${imported.written ? " (wrote)" : ""}`);

  const snapshots = listSnapshots(cwd);
  const holds = MEASUREMENT_HOLDS.map((h) => ({
    slug: h.slug,
    reason: h.reason,
  }));
  const retiredResidue = RETIRED_TOOL_ENTRIES.map((e) => ({
    path: e.path,
    slug: e.slug,
    reason: e.reason,
  }));

  const experiments = listExperiments(cwd);
  const experimentCheckpoints = experiments
    .filter((e) => e.status === "measuring" || e.status === "shipped")
    .map((e) => evaluateAllCheckpoints(e));

  if (snapshots.length === 0) {
    return {
      generatedAt,
      status: "NO_DATA",
      oauthScopeExpected: GSC_READONLY_SCOPE,
      writeAccessRequested: false,
      mutatesToolSeo: false,
      gitOperations: false,
      requiresHumanApproval: true,
      dataFreshness: null,
      comparison: null,
      importantChanges: [],
      watchChanges: [],
      infoChanges: [],
      watchlist: [],
      measurementHolds: holds,
      retiredResidue,
      experimentCheckpoints,
      notes: [
        ...notes,
        "No snapshots available. Run npm run seo:report first, then seo:monitor.",
      ],
    };
  }

  const latest = snapshots[snapshots.length - 1]!;
  const watchlist = buildWatchlistFromSnapshot(latest);
  const dataFreshness = freshnessFromSnapshot(latest);

  if (snapshots.length < 2) {
    return {
      generatedAt,
      status: "INSUFFICIENT_HISTORY",
      oauthScopeExpected: GSC_READONLY_SCOPE,
      writeAccessRequested: false,
      mutatesToolSeo: false,
      gitOperations: false,
      requiresHumanApproval: true,
      dataFreshness,
      comparison: null,
      importantChanges: [],
      watchChanges: [],
      infoChanges: [],
      watchlist,
      measurementHolds: holds,
      retiredResidue,
      experimentCheckpoints,
      notes: [
        ...notes,
        "Only one historical snapshot is available. INSUFFICIENT HISTORY is expected until a later GSC window is collected. Do not invent a comparison.",
      ],
    };
  }

  const pair = pickComparisonPair(snapshots)!;
  const comparison = detectChangesBetweenSnapshots(pair.earlier, pair.later);

  if (comparison.comparability !== "COMPARABLE") {
    return {
      generatedAt,
      status: "INSUFFICIENT_HISTORY",
      oauthScopeExpected: GSC_READONLY_SCOPE,
      writeAccessRequested: false,
      mutatesToolSeo: false,
      gitOperations: false,
      requiresHumanApproval: true,
      dataFreshness,
      comparison,
      importantChanges: [],
      watchChanges: [],
      infoChanges: [],
      watchlist,
      measurementHolds: holds,
      retiredResidue,
      experimentCheckpoints,
      notes: [
        ...notes,
        comparison.comparabilityNote,
        "No comparable multi-day GSC windows yet — wait for a newer Search Console data end date.",
      ],
    };
  }

  const activeChanges = comparison.changes.filter((c) => c.countsAsActiveAlert);
  const bySev = (s: AlertSeverity) => activeChanges.filter((c) => c.severity === s);

  return {
    generatedAt,
    status: "OK",
    oauthScopeExpected: GSC_READONLY_SCOPE,
    writeAccessRequested: false,
    mutatesToolSeo: false,
    gitOperations: false,
    requiresHumanApproval: true,
    dataFreshness,
    comparison,
    importantChanges: bySev("IMPORTANT"),
    watchChanges: bySev("WATCH"),
    infoChanges: [
      ...bySev("INFO"),
      ...comparison.changes.filter((c) => !c.countsAsActiveAlert),
    ],
    watchlist,
    measurementHolds: holds,
    retiredResidue,
    experimentCheckpoints,
    notes: [
      ...notes,
      comparison.comparabilityNote,
      "IMPORTANT/WATCH signals are post-change observations only — not proven causality.",
      "READY_FOR_PROPOSAL_REVIEW flags still require human approval; no TOOL_SEO mutation.",
    ],
  };
}

export function writeMonitorReport(
  report: MonitorReport,
  cwd = process.cwd(),
): string {
  const dir = join(cwd, DEFAULT_SEO_REPORT_DIR, DEFAULT_SEO_MONITOR_DIR);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, DEFAULT_SEO_MONITOR_LATEST);
  const json = JSON.stringify(report, null, 2);
  if (/refresh_token|access_token|client_secret/i.test(json)) {
    throw new Error("Refusing to write monitor report — credential-like fields detected.");
  }
  writeFileSync(path, json, "utf8");
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  writeFileSync(join(dir, `monitor-${stamp}.json`), json, "utf8");
  return path;
}

export function printMonitorReport(report: MonitorReport): void {
  console.log("\n# Scanonix SEO Monitor (local, read-only)\n");
  console.log(`STATUS: ${report.status}`);
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Requires human approval: ${report.requiresHumanApproval}`);
  console.log(`Mutates TOOL_SEO: ${report.mutatesToolSeo}`);
  console.log(`Git operations: ${report.gitOperations}`);

  console.log("\n## DATA FRESHNESS\n");
  if (!report.dataFreshness) {
    console.log("No snapshot freshness available.");
  } else {
    const f = report.dataFreshness;
    console.log(`Report generatedAt: ${f.generatedAt}`);
    console.log(`Newest GSC data date: ${f.newestGscDataDate ?? "(unknown)"}`);
    console.log(`Lag days: ${f.gscLagDays ?? "(unknown)"} (expected ~${f.expectedLagDays})`);
    console.log(f.note);
  }

  console.log("\n## COMPARISON WINDOW\n");
  if (!report.comparison) {
    console.log("INSUFFICIENT HISTORY — no comparable snapshot pair.");
  } else {
    console.log(`Comparability: ${report.comparison.comparability}`);
    console.log(report.comparison.comparabilityNote);
    console.log(
      `Earlier: ${report.comparison.earlier.generatedAt} (GSC end ${report.comparison.earlier.newestGscDataDate ?? "?"})`,
    );
    console.log(
      `Later:   ${report.comparison.later.generatedAt} (GSC end ${report.comparison.later.newestGscDataDate ?? "?"})`,
    );
  }

  console.log("\n## IMPORTANT CHANGES\n");
  if (!report.importantChanges.length) console.log("(none)");
  for (const c of report.importantChanges.slice(0, 15)) {
    console.log(`• [${c.severity}] ${c.kind} — ${c.subject}`);
    console.log(`  ${c.note}`);
  }

  console.log("\n## WATCHLIST\n");
  if (!report.watchlist.length) console.log("(none)");
  for (const w of report.watchlist.slice(0, 15)) {
    console.log(
      `• ${w.slug ?? "?"} | ${w.reasonCode} | evidence=${w.evidenceQuality} | band=${w.positionBand} | imp=${w.impressions}`,
    );
    console.log(`  ${w.why}`);
  }

  console.log("\n## MEASUREMENT HOLDS\n");
  for (const h of report.measurementHolds) {
    console.log(`• ${h.slug}: ${h.reason}`);
  }

  console.log("\n## RETIRED RESIDUE\n");
  for (const r of report.retiredResidue) {
    console.log(`• ${r.path}: historical GSC residue only — not an optimization candidate`);
  }

  console.log("\n## INSUFFICIENT HISTORY / NOTES\n");
  for (const n of report.notes) console.log(`• ${n}`);

  if (report.experimentCheckpoints.length) {
    console.log("\n## EXPERIMENT CHECKPOINTS\n");
    for (const group of report.experimentCheckpoints) {
      for (const cp of group) {
        console.log(
          `• ${cp.experimentId} ${cp.window}: ${cp.state} — ${cp.note}`,
        );
      }
    }
  }

  console.log(
    `\nArtifact: ${DEFAULT_SEO_REPORT_DIR}/${DEFAULT_SEO_MONITOR_DIR}/${DEFAULT_SEO_MONITOR_LATEST} (gitignored)`,
  );
  console.log("seo:monitor NEVER edits production SEO.\n");
}
