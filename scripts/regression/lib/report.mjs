/**
 * Structured regression test reporting.
 */

export function printHeader(title) {
  console.log(`\n=== ${title} ===\n`);
}

export function pass(slug, detail = "") {
  console.log(`✓ ${slug}${detail ? ` — ${detail}` : ""}`);
}

export function fail(slug, detail, meta = {}) {
  console.error(`✗ ${slug}${detail ? ` — ${detail}` : ""}`);
  if (meta.assertion) console.error(`  assertion: ${meta.assertion}`);
  if (meta.consoleErrors?.length) {
    console.error(`  console: ${meta.consoleErrors.slice(0, 3).join(" | ")}`);
  }
  if (meta.screenshot) console.error(`  screenshot: ${meta.screenshot}`);
  if (meta.output) console.error(`  output: ${JSON.stringify(meta.output)}`);
}

export function summarizeResults(results) {
  const entries = Object.entries(results);
  const passed = entries.filter(([, r]) => r.ok).length;
  const failed = entries.filter(([, r]) => !r.ok).length;
  return { total: entries.length, passed, failed, results };
}

export function exitWithSummary(summary, label) {
  console.log(`\n${label}: ${summary.passed}/${summary.total} passed`);
  if (summary.failed > 0) {
    const failedSlugs = Object.entries(summary.results)
      .filter(([, r]) => !r.ok)
      .map(([slug]) => slug);
    console.error(`Failed: ${failedSlugs.join(", ")}`);
    process.exit(1);
  }
  process.exit(0);
}
