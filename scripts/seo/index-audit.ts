/**
 * 36-tool URL Inspection audit (read-only, rate-limited).
 * Run: npm run seo:index-audit
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { SCANONIX_TOOLS } from "@/constants/tools-directory-data";
import { SEO_CANONICAL_ORIGIN, DEFAULT_SEO_REPORT_DIR } from "@/lib/seo/local/constants";
import { getAuthorizedSearchConsole } from "@/lib/seo/local/auth";
import {
  buildHumanSetupRequired,
  credentialsExist,
  findScanonixProperty,
} from "@/lib/seo/local/credentials";
import { inspectUrlsRateLimited } from "@/lib/seo/local/url-inspection";

async function main() {
  console.log("\nScanonix 36-tool URL Inspection audit (read-only)\n");

  if (!credentialsExist()) {
    const setup = buildHumanSetupRequired("GSC credentials required for index audit.");
    console.log(`HUMAN_SETUP_REQUIRED: ${setup.reason}\n`);
    setup.steps.forEach((step, i) => console.log(`${i + 1}. ${step}`));
    process.exit(1);
  }

  const { searchconsole } = await getAuthorizedSearchConsole();
  const sitesResponse = await searchconsole.sites.list({});
  const siteUrls = (sitesResponse.data.siteEntry ?? [])
    .map((entry) => entry.siteUrl)
    .filter((url): url is string => Boolean(url));

  const property = findScanonixProperty(siteUrls);
  if (!property) {
    console.error("HUMAN_SETUP_REQUIRED: Could not identify Scanonix GSC property.");
    console.error("Listed properties count:", siteUrls.length);
    process.exit(1);
  }

  const urls = SCANONIX_TOOLS.map((tool) => ({
    url: `${SEO_CANONICAL_ORIGIN}${tool.href}`,
    tool: tool.id,
  }));

  console.log(`Property resolved. Inspecting ${urls.length} tool URLs (~1 req/sec)...\n`);

  const findings = await inspectUrlsRateLimited(searchconsole, property, urls);

  let indexed = 0;
  let issues = 0;

  for (const finding of findings) {
    const status = finding.indexStatus ?? finding.issue ?? "unknown";
    if (finding.issue) issues += 1;
    if (status.toLowerCase().includes("indexed")) indexed += 1;

    console.log(
      `${finding.tool ?? "?"} | ${status}${finding.issue ? ` | ${finding.issue}` : ""}`,
    );
  }

  const dir = join(process.cwd(), DEFAULT_SEO_REPORT_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "index-audit.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), findings }, null, 2),
    "utf8",
  );

  console.log(`\nSummary: ${indexed}/${findings.length} report indexed status; ${issues} issues`);
  console.log(`JSON: ${DEFAULT_SEO_REPORT_DIR}/index-audit.json (gitignored)\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
