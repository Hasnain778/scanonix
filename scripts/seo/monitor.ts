/**
 * SEO-AUTO-3 monitor CLI — local change detection only.
 * Run: npm run seo:monitor
 *
 * Never edits production SEO. Never stages/commits/pushes.
 */

import {
  printMonitorReport,
  runSeoMonitor,
  writeMonitorReport,
} from "@/lib/seo/local/monitor-runner";

async function main() {
  const noWrite = process.argv.includes("--no-write");
  const report = runSeoMonitor();
  if (!noWrite) {
    writeMonitorReport(report);
  }
  printMonitorReport(report);

  if (report.status === "NO_DATA") {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
