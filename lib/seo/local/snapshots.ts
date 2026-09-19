/**
 * Historical GSC report snapshots (SEO-AUTO-3).
 * Gitignored under `.tmp-seo/snapshots/` only.
 * Never stores OAuth credentials or secret paths.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  DEFAULT_SEO_REPORT_DIR,
  DEFAULT_SEO_SNAPSHOTS_DIR,
  SEO_SNAPSHOT_SCHEMA_VERSION,
  SNAPSHOT_RETENTION,
} from "@/lib/seo/local/constants";
import type { SeoReportPayload } from "@/lib/seo/local/types";

export interface SnapshotPeriod {
  label: string;
  startDate?: string;
  endDate?: string;
  raw?: string;
}

export interface SnapshotMetricRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SnapshotQueryPageRow {
  query: string;
  landingPage: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SeoSnapshot {
  schemaVersion: typeof SEO_SNAPSHOT_SCHEMA_VERSION;
  generatedAt: string;
  source: "seo-report" | "fixture" | "live" | "monitor-import";
  propertySanitized?: string;
  oauthScope: string;
  writeAccessRequested: false;
  /** Parsed baseline 28d period when available. */
  periods: {
    baseline28?: SnapshotPeriod;
    comparison7d?: SnapshotPeriod;
  };
  /** Newest GSC data date represented in this snapshot (typically baseline end). */
  newestGscDataDate?: string;
  /** Calendar days between generatedAt date and newestGscDataDate (informational). */
  gscLagDays?: number | null;
  siteBaseline?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  comparison7d?: {
    label: string;
    current: { clicks: number; impressions: number; ctr: number; position: number };
    previous: { clicks: number; impressions: number; ctr: number; position: number };
  };
  pages: SnapshotMetricRow[];
  queries: SnapshotMetricRow[];
  queryPage: SnapshotQueryPageRow[];
  sitemapNotes?: string[];
  /** Hash of metric content for same-run dedupe (excludes generatedAt). */
  contentHash: string;
}

export interface PersistSnapshotResult {
  written: boolean;
  path?: string;
  reason: string;
  snapshot?: SeoSnapshot;
}

function snapshotsDir(cwd = process.cwd()): string {
  return join(cwd, DEFAULT_SEO_REPORT_DIR, DEFAULT_SEO_SNAPSHOTS_DIR);
}

export function ensureSnapshotsDir(cwd = process.cwd()): string {
  const dir = snapshotsDir(cwd);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Assert a path resolves inside the snapshots directory (retention safety). */
export function assertPathInsideSnapshotsDir(
  targetPath: string,
  cwd = process.cwd(),
): string {
  const root = resolve(snapshotsDir(cwd));
  const resolved = resolve(targetPath);
  const prefix = root.endsWith("\\") || root.endsWith("/") ? root : root + "\\";
  const altPrefix = root + "/";
  if (
    resolved !== root &&
    !resolved.startsWith(prefix) &&
    !resolved.startsWith(altPrefix) &&
    !resolved.startsWith(root + "\\") &&
    !resolved.startsWith(root + "/")
  ) {
    // Cross-platform: compare normalized
    const normRoot = root.replace(/\\/g, "/").toLowerCase();
    const normResolved = resolved.replace(/\\/g, "/").toLowerCase();
    if (normResolved !== normRoot && !normResolved.startsWith(normRoot + "/")) {
      throw new Error(
        `Refusing path outside snapshots directory: ${targetPath}`,
      );
    }
  }
  return resolved;
}

function parsePeriodBounds(raw: string | undefined): SnapshotPeriod | undefined {
  if (!raw) return undefined;
  const match = raw.match(
    /(\d{4}-\d{2}-\d{2})\s*(?:→|->|to)\s*(\d{4}-\d{2}-\d{2})/i,
  );
  if (match) {
    return {
      label: "baseline_28d",
      startDate: match[1],
      endDate: match[2],
      raw,
    };
  }
  return { label: "baseline_28d", raw };
}

function daysBetweenIsoDates(laterIso: string, earlierIso: string): number | null {
  const a = Date.parse(laterIso.slice(0, 10) + "T00:00:00.000Z");
  const b = Date.parse(earlierIso.slice(0, 10) + "T00:00:00.000Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}

function computeContentHash(snapshot: Omit<SeoSnapshot, "contentHash" | "generatedAt"> & { generatedAt?: string }): string {
  const { generatedAt: _g, ...rest } = snapshot as SeoSnapshot;
  const canonical = JSON.stringify({
    schemaVersion: rest.schemaVersion,
    periods: rest.periods,
    newestGscDataDate: rest.newestGscDataDate,
    siteBaseline: rest.siteBaseline,
    comparison7d: rest.comparison7d,
    pages: rest.pages,
    queries: rest.queries,
    queryPage: rest.queryPage,
    sitemapNotes: rest.sitemapNotes,
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

/**
 * Strip secrets and build a snapshot from a SeoReportPayload.
 * Does not include token paths, client secrets, or raw property URLs with credentials.
 */
export function buildSnapshotFromReport(
  report: SeoReportPayload,
  options: { source?: SeoSnapshot["source"] } = {},
): SeoSnapshot | null {
  if (report.status !== "CONNECTED" || !report.baseline) {
    return null;
  }

  const baselinePeriod = parsePeriodBounds(report.baseline.period);
  const newestGscDataDate = baselinePeriod?.endDate;
  const generatedDay = report.generatedAt.slice(0, 10);
  const gscLagDays =
    newestGscDataDate && generatedDay
      ? daysBetweenIsoDates(generatedDay, newestGscDataDate)
      : null;

  const pages: SnapshotMetricRow[] = (report.baseline.topPages ?? []).map((row) => ({
    key: row.keys[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  })).filter((r) => r.key);

  const queries: SnapshotMetricRow[] = (report.baseline.topQueries ?? []).map((row) => ({
    key: row.keys[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  })).filter((r) => r.key);

  const queryPage: SnapshotQueryPageRow[] = (report.queryLandingMap ?? [])
    .slice(0, 500)
    .map((row) => ({
      query: row.query,
      landingPage: row.landingPage,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));

  const draft: Omit<SeoSnapshot, "contentHash"> = {
    schemaVersion: SEO_SNAPSHOT_SCHEMA_VERSION,
    generatedAt: report.generatedAt,
    source: options.source ?? "seo-report",
    propertySanitized: report.propertySanitized,
    oauthScope: report.oauthScope,
    writeAccessRequested: false,
    periods: {
      baseline28: baselinePeriod,
      comparison7d: report.comparison7d
        ? { label: report.comparison7d.label, raw: report.comparison7d.label }
        : undefined,
    },
    newestGscDataDate,
    gscLagDays,
    siteBaseline: {
      clicks: report.baseline.clicks,
      impressions: report.baseline.impressions,
      ctr: report.baseline.ctr,
      position: report.baseline.position,
    },
    comparison7d: report.comparison7d
      ? {
          label: report.comparison7d.label,
          current: { ...report.comparison7d.current },
          previous: { ...report.comparison7d.previous },
        }
      : undefined,
    pages,
    queries,
    queryPage,
    sitemapNotes: report.sitemap?.notes,
  };

  return {
    ...draft,
    contentHash: computeContentHash(draft),
  };
}

export function listSnapshots(cwd = process.cwd()): SeoSnapshot[] {
  const dir = snapshotsDir(cwd);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  const out: SeoSnapshot[] = [];
  for (const name of files) {
    try {
      const raw = JSON.parse(readFileSync(join(dir, name), "utf8")) as SeoSnapshot;
      if (raw.schemaVersion === SEO_SNAPSHOT_SCHEMA_VERSION && raw.contentHash) {
        out.push(raw);
      }
    } catch {
      /* skip corrupt */
    }
  }
  return out.sort((a, b) => a.generatedAt.localeCompare(b.generatedAt));
}

export function readLatestSnapshot(cwd = process.cwd()): SeoSnapshot | null {
  const all = listSnapshots(cwd);
  return all.length ? all[all.length - 1]! : null;
}

/**
 * Persist snapshot if not a same-run duplicate (same contentHash already stored).
 * Always safe: writes only under snapshots/.
 */
export function persistSnapshot(
  snapshot: SeoSnapshot,
  cwd = process.cwd(),
): PersistSnapshotResult {
  ensureSnapshotsDir(cwd);
  const existing = listSnapshots(cwd);
  if (existing.some((s) => s.contentHash === snapshot.contentHash)) {
    return {
      written: false,
      reason: "duplicate_content_hash — skipped to avoid uncontrolled duplicates",
      snapshot,
    };
  }

  const stamp = snapshot.generatedAt.replace(/[:.]/g, "-");
  const filename = `snapshot-${stamp}-${snapshot.contentHash}.json`;
  const path = join(snapshotsDir(cwd), filename);
  assertPathInsideSnapshotsDir(path, cwd);

  // Refuse credential-like fields
  const json = JSON.stringify(snapshot, null, 2);
  if (/refresh_token|access_token|client_secret|"tokenPath"/i.test(json)) {
    throw new Error("Refusing to write snapshot — credential-like fields detected.");
  }

  writeFileSync(path, json, "utf8");
  applySnapshotRetention(cwd);
  return {
    written: true,
    path,
    reason: "written",
    snapshot,
  };
}

export function persistSnapshotFromReport(
  report: SeoReportPayload,
  options: { source?: SeoSnapshot["source"]; cwd?: string } = {},
): PersistSnapshotResult {
  const snapshot = buildSnapshotFromReport(report, { source: options.source });
  if (!snapshot) {
    return {
      written: false,
      reason: "report_not_connected_or_missing_baseline",
    };
  }
  return persistSnapshot(snapshot, options.cwd ?? process.cwd());
}

/**
 * Delete oldest snapshots beyond retention — ONLY inside snapshots/.
 * Never touches experiments, proposals, or seo-report.json.
 */
export function applySnapshotRetention(cwd = process.cwd()): {
  deleted: string[];
  kept: number;
} {
  const dir = snapshotsDir(cwd);
  if (!existsSync(dir)) return { deleted: [], kept: 0 };

  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const full = join(dir, name);
      assertPathInsideSnapshotsDir(full, cwd);
      let generatedAt = "";
      try {
        const raw = JSON.parse(readFileSync(full, "utf8")) as SeoSnapshot;
        generatedAt = raw.generatedAt ?? "";
      } catch {
        generatedAt = name;
      }
      return { name, full, generatedAt };
    })
    .sort((a, b) => a.generatedAt.localeCompare(b.generatedAt));

  const max = SNAPSHOT_RETENTION.maxDailySnapshots;
  const minKeep = SNAPSHOT_RETENTION.minKeep;
  const deleted: string[] = [];

  while (files.length > max && files.length > minKeep) {
    const oldest = files.shift();
    if (!oldest) break;
    assertPathInsideSnapshotsDir(oldest.full, cwd);
    // Extra guard: basename only, must end with .json, parent is snapshots
    if (basename(oldest.full) !== oldest.name || !oldest.name.endsWith(".json")) {
      throw new Error("Retention safety check failed.");
    }
    unlinkSync(oldest.full);
    deleted.push(oldest.name);
  }

  return { deleted, kept: files.length };
}

/** Import an existing seo-report.json into snapshot store (idempotent). */
export function importLatestReportAsSnapshot(cwd = process.cwd()): PersistSnapshotResult {
  const reportPath = join(cwd, DEFAULT_SEO_REPORT_DIR, "seo-report.json");
  if (!existsSync(reportPath)) {
    return { written: false, reason: "seo-report.json_missing" };
  }
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as SeoReportPayload;
  return persistSnapshotFromReport(report, { source: "monitor-import", cwd });
}
