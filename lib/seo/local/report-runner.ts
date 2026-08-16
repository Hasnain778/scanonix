import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_SEO_REPORT_DIR,
  DEFAULT_SEO_REPORT_FILENAME,
  GSC_READONLY_SCOPE,
  SEO_CANONICAL_ORIGIN,
} from "@/lib/seo/local/constants";
import { getAuthorizedSearchConsole } from "@/lib/seo/local/auth";
import { detectCannibalization } from "@/lib/seo/local/cannibalization";
import {
  buildHumanSetupRequired,
  credentialsExist,
  findScanonixProperty,
  sanitizePropertyUrl,
} from "@/lib/seo/local/credentials";
import {
  buildOpportunityReport,
  filterActionCandidates,
  filterEarlySignals,
} from "@/lib/seo/local/opportunities";
import {
  fetch7DayComparison,
  fetchBaselineReport,
  fetchQueryPageMap,
  querySearchAnalytics,
  buildDateRanges,
} from "@/lib/seo/local/search-analytics";
import {
  fetchGscSitemapStatus,
  formatSitemapSummary,
} from "@/lib/seo/local/sitemap-report";
import type { SeoReportPayload } from "@/lib/seo/local/types";

export interface RunSeoReportOptions {
  cwd?: string;
  writeJson?: boolean;
  inspectSampleUrl?: boolean;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatRowKeys(row: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }): string {
  const label = row.keys.join(" | ") || "(aggregate)";
  return `${label} — clicks ${row.clicks}, imp ${row.impressions}, CTR ${formatPct(row.ctr)}, pos ${row.position.toFixed(1)}`;
}

export async function runSeoReport(options: RunSeoReportOptions = {}): Promise<SeoReportPayload> {
  const cwd = options.cwd ?? process.cwd();
  const generatedAt = new Date().toISOString();

  if (!credentialsExist(cwd)) {
    const humanSetup = buildHumanSetupRequired("GSC OAuth credentials not configured locally.");
    const payload: SeoReportPayload = {
      generatedAt,
      status: "HUMAN_SETUP_REQUIRED",
      oauthScope: GSC_READONLY_SCOPE,
      writeAccessRequested: false,
      opportunities: [],
      queryLandingMap: [],
      cannibalization: [],
      sitemap: { notes: ["Credentials required for GSC sitemap status."] },
      indexingFindings: [],
      humanSetup,
    };

    if (options.writeJson !== false) {
      writeReportJson(payload, cwd);
    }

    return payload;
  }

  try {
    const { searchconsole } = await getAuthorizedSearchConsole(cwd);
    const sitesResponse = await searchconsole.sites.list({});
    const siteUrls = (sitesResponse.data.siteEntry ?? [])
      .map((entry) => entry.siteUrl)
      .filter((url): url is string => Boolean(url));

    const property = findScanonixProperty(siteUrls);
    if (!property) {
      const humanSetup = buildHumanSetupRequired(
        siteUrls.length
          ? `Scanonix property not uniquely identified among ${siteUrls.length} listed properties.`
          : "No Search Console properties returned for authorized account.",
      );

      const payload: SeoReportPayload = {
        generatedAt,
        status: "HUMAN_SETUP_REQUIRED",
        oauthScope: GSC_READONLY_SCOPE,
        writeAccessRequested: false,
        opportunities: [],
        queryLandingMap: [],
        cannibalization: [],
        sitemap: { notes: ["Property not resolved — sitemap check skipped."] },
        indexingFindings: [],
        humanSetup,
      };

      if (options.writeJson !== false) writeReportJson(payload, cwd);
      return payload;
    }

    const ranges = buildDateRanges();
    const [baseline, comparison7d, queryRows, pageRows, queryPageMap, sitemap] =
      await Promise.all([
        fetchBaselineReport(searchconsole, property),
        fetch7DayComparison(searchconsole, property),
        querySearchAnalytics(searchconsole, property, ranges.last28, ["query"]),
        querySearchAnalytics(searchconsole, property, ranges.last28, ["page"]),
        fetchQueryPageMap(searchconsole, property),
        fetchGscSitemapStatus(searchconsole, property),
      ]);

    const opportunities = buildOpportunityReport(queryRows, pageRows);
    const cannibalization = detectCannibalization(queryPageMap);

    const payload: SeoReportPayload = {
      generatedAt,
      status: "CONNECTED",
      property,
      propertySanitized: sanitizePropertyUrl(property),
      oauthScope: GSC_READONLY_SCOPE,
      writeAccessRequested: false,
      baseline: {
        period: baseline.period,
        clicks: baseline.clicks,
        impressions: baseline.impressions,
        ctr: baseline.ctr,
        position: baseline.position,
        topQueries: baseline.topQueries,
        topPages: baseline.topPages,
      },
      comparison7d,
      opportunities,
      queryLandingMap: queryPageMap.slice(0, 100),
      cannibalization,
      sitemap,
      indexingFindings: [],
    };

    if (options.writeJson !== false) writeReportJson(payload, cwd);
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown GSC error";
    const humanSetup = buildHumanSetupRequired(message);
    const payload: SeoReportPayload = {
      generatedAt,
      status: message.includes("not found") ? "HUMAN_SETUP_REQUIRED" : "FAIL",
      oauthScope: GSC_READONLY_SCOPE,
      writeAccessRequested: false,
      opportunities: [],
      queryLandingMap: [],
      cannibalization: [],
      sitemap: { notes: [message] },
      indexingFindings: [],
      humanSetup,
    };

    if (options.writeJson !== false) writeReportJson(payload, cwd);
    return payload;
  }
}

export function writeReportJson(payload: SeoReportPayload, cwd = process.cwd()) {
  const dir = join(cwd, DEFAULT_SEO_REPORT_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, DEFAULT_SEO_REPORT_FILENAME),
    JSON.stringify(payload, null, 2),
    "utf8",
  );
}

export function printSeoReport(payload: SeoReportPayload): void {
  console.log("\n# Scanonix SEO Report (local, read-only)\n");
  console.log(`Status: ${payload.status}`);
  console.log(`Generated: ${payload.generatedAt}`);
  console.log(`OAuth scope: ${payload.oauthScope}`);
  console.log(`Write access requested: ${payload.writeAccessRequested ? "YES" : "NO"}`);

  if (payload.propertySanitized) {
    console.log(`Property: ${payload.propertySanitized}`);
  }

  if (payload.status === "HUMAN_SETUP_REQUIRED" && payload.humanSetup) {
    console.log(`\nHUMAN_SETUP_REQUIRED: ${payload.humanSetup.reason}\n`);
    payload.humanSetup.steps.forEach((step, index) => {
      console.log(`${index + 1}. ${step}`);
    });
    console.log("\nSee docs/seo/SETUP.md for full instructions.\n");
    return;
  }

  if (payload.baseline) {
    console.log("\n## Baseline (28d)\n");
    console.log(`Period: ${payload.baseline.period}`);
    console.log(`Clicks: ${payload.baseline.clicks}`);
    console.log(`Impressions: ${payload.baseline.impressions}`);
    console.log(`CTR: ${formatPct(payload.baseline.ctr)}`);
    console.log(`Avg position: ${payload.baseline.position.toFixed(1)}`);

    console.log("\nTop queries:");
    for (const row of payload.baseline.topQueries.slice(0, 10)) {
      console.log(`  • ${formatRowKeys(row)}`);
    }

    console.log("\nTop pages:");
    for (const row of payload.baseline.topPages.slice(0, 10)) {
      console.log(`  • ${formatRowKeys(row)}`);
    }
  }

  if (payload.comparison7d) {
    const { current, previous, label } = payload.comparison7d;
    const lowVolume =
      current.impressions < 10 || previous.impressions < 10
        ? " (EARLY SIGNAL — low volume)"
        : "";
    console.log(`\n## 7d comparison${lowVolume}\n`);
    console.log(`Range: ${label}`);
    console.log(
      `Current: clicks ${current.clicks}, imp ${current.impressions}, CTR ${formatPct(current.ctr)}, pos ${current.position.toFixed(1)}`,
    );
    console.log(
      `Previous: clicks ${previous.clicks}, imp ${previous.impressions}, CTR ${formatPct(previous.ctr)}, pos ${previous.position.toFixed(1)}`,
    );
  }

  const actionCandidates = filterActionCandidates(payload.opportunities);
  const earlySignals = filterEarlySignals(payload.opportunities);

  console.log("\n## Opportunities\n");
  console.log(`Action candidates: ${actionCandidates.length}`);
  for (const item of actionCandidates.slice(0, 10)) {
    const target = item.query ?? item.page ?? "";
    console.log(
      `  • [${item.category}] ${target} — imp ${item.impressions}, CTR ${formatPct(item.ctr)}, pos ${item.position.toFixed(1)}`,
    );
  }

  console.log(`\nEarly signals (low volume): ${earlySignals.length} (not SEO wins/losses)`);

  if (payload.cannibalization.length) {
    console.log("\n## Cannibalization candidates\n");
    for (const item of payload.cannibalization.slice(0, 5)) {
      console.log(
        `  • [${item.signal}] "${item.query}" — ${item.pages.length} URLs`,
      );
    }
  }

  if (payload.queryLandingMap.length) {
    console.log("\n## Query → landing page (top 10)\n");
    for (const row of payload.queryLandingMap.slice(0, 10)) {
      console.log(
        `  • "${row.query}" → ${row.landingPage} (imp ${row.impressions}, clicks ${row.clicks})`,
      );
    }
  }

  console.log("\n## Sitemap\n");
  for (const line of formatSitemapSummary(payload.sitemap)) {
    console.log(`  ${line}`);
  }

  console.log(`\nCanonical origin: ${SEO_CANONICAL_ORIGIN}`);
  console.log(`JSON output: ${DEFAULT_SEO_REPORT_DIR}/${DEFAULT_SEO_REPORT_FILENAME} (gitignored)\n`);
}
