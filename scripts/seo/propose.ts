/**
 * SEO-AUTO-2 proposal CLI — analysis artifacts only.
 * Run: npm run seo:propose
 *
 * Never edits production SEO. Never stages/commits/pushes.
 * Never prints OAuth tokens/secrets.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_SEO_PROPOSALS_DIR,
  DEFAULT_SEO_PROPOSALS_LATEST,
  DEFAULT_SEO_REPORT_DIR,
  DEFAULT_SEO_REPORT_FILENAME,
  GSC_READONLY_SCOPE,
} from "@/lib/seo/local/constants";
import { credentialsExist } from "@/lib/seo/local/credentials";
import {
  buildProposalsFromReport,
  type ProposalBundle,
} from "@/lib/seo/local/proposals";
import { runSeoReport } from "@/lib/seo/local/report-runner";
import type { SeoReportPayload } from "@/lib/seo/local/types";

function proposalsDir(cwd = process.cwd()): string {
  return join(cwd, DEFAULT_SEO_REPORT_DIR, DEFAULT_SEO_PROPOSALS_DIR);
}

function stripSecretsFromBundle(bundle: ProposalBundle): ProposalBundle {
  // Structural guarantee — bundle schema has no credential fields.
  const json = JSON.stringify(bundle);
  if (
    /refresh_token|access_token|client_secret|client_id["']?\s*:/i.test(json)
  ) {
    throw new Error("Refusing to write proposal artifact — unexpected credential-like fields detected.");
  }
  return bundle;
}

function loadReportFromDisk(path: string): SeoReportPayload {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as SeoReportPayload;
}

function printHumanSummary(bundle: ProposalBundle): void {
  console.log("\n# Scanonix SEO Proposals (local, read-only)\n");
  console.log(`Generated: ${bundle.generatedAt}`);
  console.log(`Source: ${bundle.source}`);
  console.log(`OAuth scope expected: ${bundle.oauthScopeExpected}`);
  console.log(`Mutates TOOL_SEO: ${bundle.mutatesToolSeo}`);
  console.log(`Git operations: ${bundle.gitOperations}`);
  console.log(`Requires human approval: ${bundle.requiresHumanApproval}`);
  console.log(
    `Rows: ${bundle.proposals.length} (active candidates: ${bundle.activeCandidateCount}, retired residue: ${bundle.retiredResidueCount})\n`,
  );

  const active = bundle.proposals.filter((p) => p.urlLifecycle === "ACTIVE");
  const retired = bundle.proposals.filter((p) => p.urlLifecycle === "RETIRED");

  console.log("## Active tool pages\n");
  const show = active.slice(0, 15);
  for (const p of show) {
    const block = p.blocked ? "BLOCKED" : "OPEN";
    console.log(
      `• [${block}] ${p.slug ?? "?"} | ${p.recommendationType} | evidence=${p.evidenceQuality} | band=${p.positionBand} | imp=${p.pageMetrics.impressions} pos=${p.pageMetrics.position.toFixed(1)}`,
    );
    console.log(`  ${p.reasoning}`);
    if (p.blockedReasons.length) {
      console.log(`  reasons: ${p.blockedReasons.join(" | ")}`);
    }
  }
  if (active.length > show.length) {
    console.log(`\n… ${active.length - show.length} more active rows in JSON artifact`);
  }
  if (active.length === 0) {
    console.log("(none)");
  }

  if (retired.length > 0) {
    console.log("\n## Retired URL historical residue (not optimization candidates)\n");
    for (const p of retired.slice(0, 10)) {
      console.log(
        `• [RETIRED] ${p.slug ?? "?"} | ${p.recommendationType} | imp=${p.pageMetrics.impressions} pos=${p.pageMetrics.position.toFixed(1)} (historical — ignore band as opportunity)`,
      );
      console.log(`  ${p.reasoning}`);
    }
  }

  console.log(
    `\nArtifacts: ${DEFAULT_SEO_REPORT_DIR}/${DEFAULT_SEO_PROPOSALS_DIR}/ (gitignored)`,
  );
  console.log("seo:propose NEVER edits production SEO. Human review required.\n");
}

async function main() {
  const cwd = process.cwd();
  const args = process.argv.slice(2);
  const fromReportIdx = args.indexOf("--from-report");
  const fromReport =
    fromReportIdx >= 0 ? args[fromReportIdx + 1] : undefined;
  const live = args.includes("--live");
  const noWrite = args.includes("--no-write");

  let report: SeoReportPayload | null = null;
  let source: ProposalBundle["source"] = "seo-report";

  if (fromReport) {
    if (!existsSync(fromReport)) {
      console.error(`Report not found: ${fromReport}`);
      process.exit(1);
    }
    report = loadReportFromDisk(fromReport);
    source = "fixture";
  } else {
    const defaultReport = join(cwd, DEFAULT_SEO_REPORT_DIR, DEFAULT_SEO_REPORT_FILENAME);
    if (existsSync(defaultReport) && !live) {
      report = loadReportFromDisk(defaultReport);
      source = "seo-report";
      console.log(`Using existing ${DEFAULT_SEO_REPORT_DIR}/${DEFAULT_SEO_REPORT_FILENAME}`);
    } else if (live || credentialsExist(cwd)) {
      if (!credentialsExist(cwd)) {
        console.error("HUMAN_SETUP_REQUIRED: GSC credentials missing for --live.");
        process.exit(1);
      }
      console.log("Fetching live GSC report (read-only scope)...");
      report = await runSeoReport({ cwd, writeJson: true });
      source = "live";
      if (report.status !== "CONNECTED") {
        console.error(`GSC status: ${report.status}`);
        if (report.humanSetup) {
          console.error(report.humanSetup.reason);
        }
        process.exit(1);
      }
    } else {
      console.error(
        "No GSC report found. Run `npm run seo:report` first, or pass --from-report <path>, or --live with local credentials.",
      );
      process.exit(1);
    }
  }

  if (!report) {
    console.error("Failed to load SEO report.");
    process.exit(1);
  }

  // Sanity: scope should remain readonly when present
  if (report.oauthScope && report.oauthScope !== GSC_READONLY_SCOPE) {
    console.error(`Unexpected OAuth scope on report: ${report.oauthScope}`);
    process.exit(1);
  }

  const bundle = stripSecretsFromBundle(
    buildProposalsFromReport(report, { source }),
  );

  if (!noWrite) {
    const dir = proposalsDir(cwd);
    mkdirSync(dir, { recursive: true });
    const stamp = bundle.generatedAt.replace(/[:.]/g, "-");
    const latestPath = join(dir, DEFAULT_SEO_PROPOSALS_LATEST);
    const stampedPath = join(dir, `proposals-${stamp}.json`);
    const payload = JSON.stringify(bundle, null, 2);
    writeFileSync(latestPath, payload, "utf8");
    writeFileSync(stampedPath, payload, "utf8");
    console.log(`Wrote ${DEFAULT_SEO_REPORT_DIR}/${DEFAULT_SEO_PROPOSALS_DIR}/${DEFAULT_SEO_PROPOSALS_LATEST}`);
  }

  printHumanSummary(bundle);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
