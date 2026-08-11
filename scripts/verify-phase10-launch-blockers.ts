/**
 * Phase 10.1 — verify Compress PDF fallback and Redact PDF launch hide.
 * Run: npx tsx scripts/verify-phase10-launch-blockers.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function main(): void {
  const compressRoute = read("app/api/tools/pdf/compress/route.ts");
  assert.match(compressRoute, /compressPdfBytes/);
  assert.match(compressRoute, /X-Scanonix-Provider": "pdf-lib"/);
  assert.doesNotMatch(compressRoute, /nativeProviderUnavailableMessage\("PDF compression"\)/);

  const redactPage = read("app/tools/redact-pdf/page.tsx");
  assert.match(redactPage, /isPdfRedactionConfigured/);
  assert.match(redactPage, /ToolLaunchUnavailable/);

  const homepage = read("constants/homepage-tools.ts");
  assert.match(homepage, /id: "redact-pdf"[\s\S]*?available: false/);
  assert.match(homepage, /id: "redact-pdf"[\s\S]*?comingSoon: true/);

  console.log("Phase 10.1 launch blocker checks passed.");
}

main();
