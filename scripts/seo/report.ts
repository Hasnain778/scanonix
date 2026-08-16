/**
 * Scanonix SEO specialist report — read-only Search Console data.
 * Run: npm run seo:report  (alias: npm run seo:gsc)
 */

import { printSeoReport, runSeoReport } from "@/lib/seo/local/report-runner";

async function main() {
  const writeJson = !process.argv.includes("--no-json");
  const payload = await runSeoReport({ writeJson });
  printSeoReport(payload);

  if (payload.status === "FAIL") {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
