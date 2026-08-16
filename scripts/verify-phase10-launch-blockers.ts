/**
 * Phase 10.1 — verify Compress PDF fallback and Redact PDF launch readiness.
 * Run: npx tsx scripts/verify-phase10-launch-blockers.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HOMEPAGE_CATEGORY_GRIDS, HOMEPAGE_TOOLS } from "../constants/homepage-tools";
import { getToolAccess } from "../lib/plan/tool-access";

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
  assert.match(redactPage, /LazyRedactPdfProClientTool/);
  assert.doesNotMatch(redactPage, /ToolLaunchUnavailable/);
  assert.doesNotMatch(redactPage, /isPdfRedactionConfigured/);
  assert.match(redactPage, /createToolPageMetadata\("redact-pdf"\)/);

  const redactHomepage = HOMEPAGE_TOOLS.find((tool) => tool.id === "redact-pdf");
  assert.ok(redactHomepage, "redact-pdf is listed in HOMEPAGE_TOOLS");
  assert.equal(redactHomepage.available, true);
  assert.equal(redactHomepage.href, "/tools/redact-pdf");

  const redactGrid = HOMEPAGE_CATEGORY_GRIDS.security.find((item) => item.id === "redact-pdf");
  assert.ok(redactGrid, "redact-pdf is listed in security homepage grid");
  assert.notEqual(redactGrid.comingSoon, true);
  assert.equal(redactGrid.proOnly, true);

  const redactAccess = getToolAccess("redact-pdf");
  assert.equal(redactAccess?.requiresPro, true);
  assert.equal(redactAccess?.requiresAuth, true);
  assert.equal(redactAccess?.processing, "client");

  console.log("Phase 10.1 launch blocker checks passed.");
}

main();
