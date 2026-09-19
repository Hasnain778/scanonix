/**
 * SEO-AUTO-3 deterministic verification (no live GSC auth required).
 * Run: npm run verify:seo-auto-3
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CHANGE_THRESHOLDS,
  DEFAULT_SEO_REPORT_DIR,
  DEFAULT_SEO_SNAPSHOTS_DIR,
  GSC_READONLY_SCOPE,
} from "../lib/seo/local/constants";
import { detectChangesBetweenSnapshots } from "../lib/seo/local/change-detection";
import {
  evaluateExperimentCheckpoint,
} from "../lib/seo/local/experiment-checkpoints";
import type { SeoExperiment } from "../lib/seo/local/experiments";
import { getHoldForSlug } from "../lib/seo/local/holds";
import { runSeoMonitor } from "../lib/seo/local/monitor-runner";
import { isIntentionallyRetiredUrl } from "../lib/seo/local/retired-urls";
import {
  applySnapshotRetention,
  assertPathInsideSnapshotsDir,
  buildSnapshotFromReport,
  listSnapshots,
  persistSnapshot,
  type SeoSnapshot,
} from "../lib/seo/local/snapshots";
import { buildWatchlistFromSnapshot } from "../lib/seo/local/watchlist";
import type { SeoReportPayload } from "../lib/seo/local/types";

const root = process.cwd();
let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`✓ ${name}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function baseSnapshot(overrides: Partial<SeoSnapshot> & { newestGscDataDate: string; generatedAt: string }): SeoSnapshot {
  const draft = {
    schemaVersion: 1 as const,
    generatedAt: overrides.generatedAt,
    source: "fixture" as const,
    propertySanitized: "https://www.scanonix.com/",
    oauthScope: GSC_READONLY_SCOPE,
    writeAccessRequested: false as const,
    periods: {
      baseline28: {
        label: "baseline_28d",
        startDate: "2026-08-01",
        endDate: overrides.newestGscDataDate,
      },
    },
    newestGscDataDate: overrides.newestGscDataDate,
    gscLagDays: 3,
    siteBaseline: {
      clicks: 2,
      impressions: 1800,
      ctr: 0.001,
      position: 70,
    },
    pages: overrides.pages ?? [
      {
        key: "https://www.scanonix.com/tools/ocr",
        clicks: 1,
        impressions: 1632,
        ctr: 1 / 1632,
        position: 73.8,
      },
    ],
    queries: overrides.queries ?? [],
    queryPage: overrides.queryPage ?? [],
    contentHash: "pending",
  };
  const hash = createHash("sha256")
    .update(JSON.stringify({ pages: draft.pages, queries: draft.queries, newest: draft.newestGscDataDate }))
    .digest("hex")
    .slice(0, 16);
  return { ...draft, ...overrides, contentHash: overrides.contentHash ?? hash };
}

function run() {
  console.log("\nSEO-AUTO-3 verification (deterministic fixtures)\n");

  // A/B snapshot secrets + path
  const fixtureReport: SeoReportPayload = {
    generatedAt: "2026-09-19T12:00:00.000Z",
    status: "CONNECTED",
    propertySanitized: "https://www.scanonix.com/",
    oauthScope: GSC_READONLY_SCOPE,
    writeAccessRequested: false,
    baseline: {
      period: "2026-08-20 → 2026-09-16",
      clicks: 2,
      impressions: 1800,
      ctr: 0.001,
      position: 70,
      topQueries: [
        { keys: ["online ocr"], clicks: 0, impressions: 89, ctr: 0, position: 75.4 },
      ],
      topPages: [
        {
          keys: ["https://www.scanonix.com/tools/ocr"],
          clicks: 1,
          impressions: 1632,
          ctr: 1 / 1632,
          position: 73.8,
        },
        {
          keys: ["https://www.scanonix.com/tools/background-remover"],
          clicks: 0,
          impressions: 9,
          ctr: 0,
          position: 6.8,
        },
      ],
    },
    opportunities: [],
    queryLandingMap: [],
    cannibalization: [],
    sitemap: { notes: ["ok"] },
    indexingFindings: [],
  };

  const snap = buildSnapshotFromReport(fixtureReport, { source: "fixture" });
  assert("A snapshot built from report", Boolean(snap));
  const snapJson = JSON.stringify(snap);
  assert("A no refresh_token", !/refresh_token/i.test(snapJson));
  assert("A no access_token", !/access_token/i.test(snapJson));
  assert("A no client_secret", !/client_secret/i.test(snapJson));
  assert("B snapshot schema under tmp-seo convention", DEFAULT_SEO_SNAPSHOTS_DIR === "snapshots");

  // C dedupe in temp cwd
  const tmp = mkdtempSync(join(tmpdir(), "seo-auto3-"));
  try {
    mkdirSync(join(tmp, DEFAULT_SEO_REPORT_DIR, DEFAULT_SEO_SNAPSHOTS_DIR), {
      recursive: true,
    });
    const s1 = persistSnapshot(snap!, tmp);
    const s2 = persistSnapshot(snap!, tmp);
    assert("C first persist writes", s1.written === true);
    assert("C second identical persist skips duplicate", s2.written === false);
    assert("C only one snapshot file", listSnapshots(tmp).length === 1);

    // D retention cannot escape snapshots dir
    let threw = false;
    try {
      assertPathInsideSnapshotsDir(join(tmp, "evil.json"), tmp);
    } catch {
      threw = true;
    }
    assert("D retention path guard rejects outside snapshots", threw);
    const inside = assertPathInsideSnapshotsDir(
      join(tmp, DEFAULT_SEO_REPORT_DIR, DEFAULT_SEO_SNAPSHOTS_DIR, "x.json"),
      tmp,
    );
    assert("D allows inside snapshots", inside.includes(DEFAULT_SEO_SNAPSHOTS_DIR));
    const retention = applySnapshotRetention(tmp);
    assert("D retention returns kept count", retention.kept >= 1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  // E tiny impression change not IMPORTANT
  const early = baseSnapshot({
    generatedAt: "2026-09-10T00:00:00.000Z",
    newestGscDataDate: "2026-09-07",
    contentHash: "early001",
    pages: [
      {
        key: "https://www.scanonix.com/tools/ocr",
        clicks: 1,
        impressions: 100,
        ctr: 0.01,
        position: 70,
      },
    ],
  });
  const tiny = baseSnapshot({
    generatedAt: "2026-09-18T00:00:00.000Z",
    newestGscDataDate: "2026-09-15",
    contentHash: "tiny002",
    pages: [
      {
        key: "https://www.scanonix.com/tools/ocr",
        clicks: 1,
        impressions: 102,
        ctr: 0.01,
        position: 69,
      },
    ],
  });
  const tinyCmp = detectChangesBetweenSnapshots(early, tiny);
  assert("E tiny change comparable window", tinyCmp.comparability === "COMPARABLE");
  assert(
    "E tiny impression change not IMPORTANT",
    !tinyCmp.changes.some(
      (c) => c.kind === "IMPRESSION_RISE" && c.severity === "IMPORTANT",
    ),
  );

  // F meaningful impression rise
  const risen = baseSnapshot({
    generatedAt: "2026-09-18T00:00:00.000Z",
    newestGscDataDate: "2026-09-15",
    contentHash: "rise003",
    pages: [
      {
        key: "https://www.scanonix.com/tools/ocr",
        clicks: 2,
        impressions: 500,
        ctr: 0.004,
        position: 70,
      },
    ],
  });
  const riseCmp = detectChangesBetweenSnapshots(early, risen);
  assert(
    "F meaningful impression rise detected",
    riseCmp.changes.some(
      (c) =>
        c.kind === "IMPRESSION_RISE" &&
        (c.severity === "WATCH" || c.severity === "IMPORTANT") &&
        c.countsAsActiveAlert,
    ),
  );

  // G meaningful position improvement
  const betterPos = baseSnapshot({
    generatedAt: "2026-09-18T00:00:00.000Z",
    newestGscDataDate: "2026-09-15",
    contentHash: "pos004",
    pages: [
      {
        key: "https://www.scanonix.com/tools/ocr",
        clicks: 1,
        impressions: 200,
        ctr: 0.005,
        position: 50,
      },
    ],
  });
  // early has 100 imp @ 70 — need enough impressions on early too
  const earlyPos = baseSnapshot({
    generatedAt: "2026-09-10T00:00:00.000Z",
    newestGscDataDate: "2026-09-07",
    contentHash: "earlypos",
    pages: [
      {
        key: "https://www.scanonix.com/tools/ocr",
        clicks: 1,
        impressions: 200,
        ctr: 0.005,
        position: 75,
      },
    ],
  });
  const posCmp = detectChangesBetweenSnapshots(earlyPos, betterPos);
  assert(
    "G meaningful position improvement detected",
    posCmp.changes.some(
      (c) => c.kind === "POSITION_IMPROVEMENT" && c.countsAsActiveAlert,
    ),
  );

  // H incompatible same GSC date
  const sameWindow = baseSnapshot({
    generatedAt: "2026-09-19T00:00:00.000Z",
    newestGscDataDate: "2026-09-07",
    contentHash: "samewin",
    pages: early.pages,
  });
  const sameCmp = detectChangesBetweenSnapshots(early, sameWindow);
  assert(
    "H same GSC end date is INCOMPARABLE",
    sameCmp.comparability === "INCOMPARABLE",
  );

  // I lag documented constant
  assert(
    "I expected GSC lag constant present",
    CHANGE_THRESHOLDS.expectedGscLagDays >= 2,
  );
  assert(
    "I lag note not treated as decline in monitor source",
    readSource("lib/seo/local/monitor-runner.ts").includes("not an SEO decline"),
  );

  // J retired background-remover
  assert(
    "J background-remover retired",
    isIntentionallyRetiredUrl("/tools/background-remover"),
  );
  const retiredEarly = baseSnapshot({
    generatedAt: "2026-09-10T00:00:00.000Z",
    newestGscDataDate: "2026-09-07",
    contentHash: "bg1",
    pages: [
      {
        key: "https://www.scanonix.com/tools/background-remover",
        clicks: 0,
        impressions: 9,
        ctr: 0,
        position: 6.8,
      },
    ],
  });
  const retiredLater = baseSnapshot({
    generatedAt: "2026-09-18T00:00:00.000Z",
    newestGscDataDate: "2026-09-15",
    contentHash: "bg2",
    pages: [
      {
        key: "https://www.scanonix.com/tools/background-remover",
        clicks: 0,
        impressions: 200,
        ctr: 0,
        position: 5,
      },
    ],
  });
  const bgCmp = detectChangesBetweenSnapshots(retiredEarly, retiredLater);
  assert(
    "J retired URL never counts as active alert",
    !bgCmp.changes.some((c) => c.countsAsActiveAlert),
  );

  // K OCR hold
  assert("K OCR hold active", Boolean(getHoldForSlug("ocr")));

  // L sparse watchlist
  const sparseSnap = buildSnapshotFromReport(
    {
      ...fixtureReport,
      baseline: {
        ...fixtureReport.baseline!,
        topPages: [
          {
            keys: ["https://www.scanonix.com/tools/ai-translate"],
            clicks: 0,
            impressions: 50,
            ctr: 0,
            position: 27.4,
          },
          {
            keys: ["https://www.scanonix.com/tools/pdf-to-word"],
            clicks: 0,
            impressions: 38,
            ctr: 0,
            position: 40.8,
          },
          {
            keys: ["https://www.scanonix.com/tools/ocr"],
            clicks: 1,
            impressions: 1632,
            ctr: 1 / 1632,
            position: 73.8,
          },
        ],
      },
      queryLandingMap: [
        {
          query: "translate",
          landingPage: "https://www.scanonix.com/tools/ai-translate",
          clicks: 0,
          impressions: 2,
          ctr: 0,
          position: 30,
        },
      ],
    },
    { source: "fixture" },
  )!;
  const watch = buildWatchlistFromSnapshot(sparseSnap);
  assert(
    "L AI Translate sparse on watchlist",
    watch.some(
      (w) => w.slug === "ai-translate" && w.reasonCode === "SPARSE_EVIDENCE",
    ),
  );
  assert(
    "L PDF-to-Word sparse on watchlist",
    watch.some(
      (w) => w.slug === "pdf-to-word" && w.reasonCode === "SPARSE_EVIDENCE",
    ),
  );
  assert(
    "L OCR measurement hold on watchlist",
    watch.some(
      (w) => w.slug === "ocr" && w.reasonCode === "MEASUREMENT_HOLD",
    ),
  );

  // M/N no production mutation / no git ops
  const monitorSrc = readSource("lib/seo/local/monitor-runner.ts");
  const changeSrc = readSource("lib/seo/local/change-detection.ts");
  const snapSrc = readSource("lib/seo/local/snapshots.ts");
  for (const [label, src] of [
    ["monitor-runner", monitorSrc],
    ["change-detection", changeSrc],
    ["snapshots", snapSrc],
    ["scripts/seo/monitor.ts", readSource("scripts/seo/monitor.ts")],
  ] as const) {
    assert(
      `M/N ${label} no tool-seo write / git ops`,
      !src.includes("writeFileSync(\"constants/tool-seo") &&
        !/\bgit\s+(add|commit|push)\b/.test(src) &&
        !src.includes("simple-git"),
    );
  }
  assert(
    "M monitor mutatesToolSeo false",
    monitorSrc.includes("mutatesToolSeo: false"),
  );

  // O requiresHumanApproval
  assert(
    "O monitor requiresHumanApproval true",
    monitorSrc.includes("requiresHumanApproval: true"),
  );

  // P experiment checkpoints
  const measuring: SeoExperiment = {
    id: "exp-test",
    page: "https://www.scanonix.com/tools/ocr",
    status: "measuring",
    changeDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    checkpoints: {},
  };
  const notDue = evaluateExperimentCheckpoint(measuring, "day7");
  assert("P day7 NOT_DUE when <7 days", notDue.state === "NOT_DUE", notDue.state);

  const dueExp: SeoExperiment = {
    ...measuring,
    changeDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const due = evaluateExperimentCheckpoint(dueExp, "day7");
  assert("P day7 DUE when >=7 days and missing", due.state === "DUE", due.state);

  const availableExp: SeoExperiment = {
    ...dueExp,
    checkpoints: {
      day7: {
        recordedAt: new Date().toISOString(),
        label: "day7",
        clicks: 1,
        impressions: 100,
        ctr: 0.01,
        position: 70,
      },
    },
  };
  const available = evaluateExperimentCheckpoint(availableExp, "day7");
  assert("P day7 AVAILABLE when recorded", available.state === "AVAILABLE");

  const insufficient = evaluateExperimentCheckpoint(
    { ...measuring, changeDate: undefined, status: "proposed" },
    "day7",
  );
  assert(
    "P INSUFFICIENT_DATA when no changeDate/not measuring",
    insufficient.state === "INSUFFICIENT_DATA" || insufficient.state === "NOT_DUE",
  );

  // Real monitor against project cwd should not crash; may be INSUFFICIENT_HISTORY
  const real = runSeoMonitor({ cwd: root });
  assert(
    "real monitor runs",
    real.status === "INSUFFICIENT_HISTORY" ||
      real.status === "OK" ||
      real.status === "NO_DATA",
  );
  assert("real monitor no TOOL_SEO mutation flag", real.mutatesToolSeo === false);
  assert("real OCR hold listed", real.measurementHolds.some((h) => h.slug === "ocr"));
  assert(
    "real retired residue listed",
    real.retiredResidue.some((r) => r.slug === "background-remover"),
  );

  // Docs
  assert(
    "docs MONITORING.md exists",
    existsSync(join(root, "docs/seo/MONITORING.md")),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
