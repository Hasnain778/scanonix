/**
 * SEO experiment status — compare ledger baseline vs fresh metrics (SEO-AUTO-2).
 * Run: npm run seo:experiment-status
 *
 * Correlation / post-change signals only — never claims causality.
 * Never edits production SEO. Never auto-approves.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_SEO_REPORT_DIR,
  DEFAULT_SEO_REPORT_FILENAME,
} from "@/lib/seo/local/constants";
import {
  evaluateExperimentAgainstMetrics,
  listExperiments,
  readExperiment,
  type ExperimentStatusReport,
} from "@/lib/seo/local/experiments";
import { extractToolSlugFromPageUrl } from "@/lib/seo/local/holds";
import type { SeoReportPayload } from "@/lib/seo/local/types";

function pageKey(url: string): string {
  try {
    if (url.includes("://")) return new URL(url).pathname.replace(/\/$/, "");
  } catch {
    /* ignore */
  }
  return url.split("?")[0]?.replace(/\/$/, "") || url;
}

function metricsForExperimentPage(
  report: SeoReportPayload,
  page: string,
  slug?: string,
): { clicks: number; impressions: number; ctr: number; position: number } | null {
  const pages = report.baseline?.topPages ?? [];
  const want = pageKey(page);
  const slugPath = slug ? `/tools/${slug}` : undefined;

  for (const row of pages) {
    const p = row.keys[0] ?? "";
    const key = pageKey(p);
    if (key === want || (slugPath && key.endsWith(slugPath))) {
      return {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      };
    }
  }

  // Fall back to aggregated query landing map
  const mapRows = report.queryLandingMap.filter((row) => {
    const key = pageKey(row.landingPage);
    return key === want || (slugPath && key.endsWith(slugPath));
  });
  if (!mapRows.length) return null;

  const impressions = mapRows.reduce((s, r) => s + r.impressions, 0);
  const clicks = mapRows.reduce((s, r) => s + r.clicks, 0);
  const weightedPos = mapRows.reduce((s, r) => s + r.position * r.impressions, 0);
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPos / impressions : 0,
  };
}

function daysSince(iso?: string): number | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

function printReport(report: ExperimentStatusReport, page: string): void {
  console.log(`\nExperiment: ${report.experimentId}`);
  console.log(`Page: ${page}`);
  console.log(`Ledger status: ${report.status}`);
  console.log(`Signal: ${report.signal}`);
  console.log(`Trend: ${report.trend}`);
  console.log(`Note: ${report.note}`);
  console.log(`Causality claimed: ${report.causalityClaim}`);
}

async function main() {
  const args = process.argv.slice(2);
  const idIdx = args.indexOf("--id");
  const id = idIdx >= 0 ? args[idIdx + 1] : undefined;
  const reportIdx = args.indexOf("--from-report");
  const reportPath =
    reportIdx >= 0
      ? args[reportIdx + 1]
      : join(process.cwd(), DEFAULT_SEO_REPORT_DIR, DEFAULT_SEO_REPORT_FILENAME);

  console.log("\n# Scanonix SEO Experiment Status (local)\n");
  console.log("Correlation / post-change signals only — not proven causality.");
  console.log("This command never auto-approves and never edits production SEO.\n");

  if (!existsSync(reportPath)) {
    console.error(
      `GSC report not found at ${reportPath}. Run npm run seo:report or pass --from-report <path>.`,
    );
    process.exit(1);
  }

  const gscReport = JSON.parse(readFileSync(reportPath, "utf8")) as SeoReportPayload;
  const experiments = id
    ? [readExperiment(id)].filter(Boolean)
    : listExperiments();

  if (!experiments.length) {
    console.log("No experiments found under .tmp-seo/experiments/.");
    console.log("Create drafts via library createProposedExperiment (status=proposed only).\n");
    process.exit(0);
  }

  for (const experiment of experiments) {
    if (!experiment) continue;
    const slug =
      experiment.slug ?? extractToolSlugFromPageUrl(experiment.page) ?? undefined;
    const metrics = metricsForExperimentPage(gscReport, experiment.page, slug);
    if (!metrics) {
      console.log(`\nExperiment: ${experiment.id}`);
      console.log("Signal: INSUFFICIENT_EVIDENCE");
      console.log("Note: Page metrics not found in current GSC report artifact.");
      continue;
    }
    const status = evaluateExperimentAgainstMetrics(experiment, metrics, {
      daysSinceChange: daysSince(experiment.changeDate),
    });
    printReport(status, experiment.page);
  }

  console.log("");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
