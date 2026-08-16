/**
 * Discovery/metadata parity tests (Phase 128D).
 * Run: npx tsx scripts/verify-tool-discovery.ts
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HOMEPAGE_CATEGORY_GRIDS,
  HOMEPAGE_TOOLS,
} from "../constants/homepage-tools";
import {
  SCANONIX_TOOLS,
  TOOL_CATEGORY_FILTERS,
} from "../constants/tools-directory-data";
import { getToolCategoryMeta, toolMatchesCategoryFilter } from "../constants/tool-categories";
import { INDEXABLE_TOOL_PATHS } from "../constants/tool-seo";
import { getToolAccess } from "../lib/plan/tool-access";
import { findTools } from "../lib/tools/tool-finder";
import { searchHomeTools } from "../lib/tools/search-home-tools";

const root = process.cwd();
const TEMP_ROUTE_SUFFIXES = ["-client"];

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`✓ ${name}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function listCanonicalToolSlugs(): string[] {
  const toolsDir = join(root, "app", "tools");
  return readdirSync(toolsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== "image" &&
        !TEMP_ROUTE_SUFFIXES.some((suffix) => entry.name.endsWith(suffix)),
    )
    .filter((entry) => existsSync(join(toolsDir, entry.name, "page.tsx")))
    .map((entry) => entry.name)
    .sort();
}

function getAvailableHomepageToolIds(): string[] {
  return HOMEPAGE_TOOLS.filter((tool) => tool.available)
    .map((tool) => tool.id)
    .filter((id) => id !== "website-monitoring" && id !== "website-scanner")
    .sort();
}

function run() {
  console.log("\nTool discovery metadata verification (Phase 128D)\n");

  const canonicalSlugs = listCanonicalToolSlugs();
  const availableHomepageIds = getAvailableHomepageToolIds();
  const directoryIds = SCANONIX_TOOLS.map((tool) => tool.id).sort();
  const expectedCanonicalCount = 36;

  // 1. canonical tool count matches expected inventory
  assert(
    "1 canonical tool count matches expected inventory",
    canonicalSlugs.length === expectedCanonicalCount,
    `expected ${expectedCanonicalCount}, got ${canonicalSlugs.length}`,
  );

  // 2. /tools contains every available canonical tool
  const missingFromDirectory = canonicalSlugs.filter(
    (slug) => !directoryIds.includes(slug),
  );
  assert(
    "2 /tools contains every available canonical tool",
    missingFromDirectory.length === 0,
    missingFromDirectory.join(", ") || undefined,
  );

  // 3. no temp routes in directory
  const tempInDirectory = directoryIds.filter((id) =>
    TEMP_ROUTE_SUFFIXES.some((suffix) => id.endsWith(suffix)),
  );
  assert(
    "3 no temp routes in directory",
    tempInDirectory.length === 0,
    tempInDirectory.join(", ") || undefined,
  );

  // 4. security tools present
  const securityToolIds = [
    "protect-pdf",
    "unlock-pdf",
    "watermark-pdf",
    "redact-pdf",
    "metadata-cleaner",
    "security-scan",
  ];
  const missingSecurity = securityToolIds.filter(
    (id) => !directoryIds.includes(id),
  );
  assert(
    "4 security tools present in directory",
    missingSecurity.length === 0,
    missingSecurity.join(", ") || undefined,
  );

  // 5. webp-to-png present
  assert(
    "5 webp-to-png present in directory",
    directoryIds.includes("webp-to-png"),
  );
  assert(
    "5 webp-to-png present in homepage tools",
    HOMEPAGE_TOOLS.some((tool) => tool.id === "webp-to-png" && tool.available),
  );

  // 6. Redact classified PRO + CLIENT
  const redactAccess = getToolAccess("redact-pdf");
  assert(
    "6 redact-pdf is PRO + CLIENT in tool-access",
    redactAccess?.requiresPro === true && redactAccess.processing === "client",
  );

  // 7. Protect classified PRO + SERVER
  const protectAccess = getToolAccess("protect-pdf");
  assert(
    "7 protect-pdf is PRO + SERVER in tool-access",
    protectAccess?.requiresPro === true && protectAccess.processing === "server",
  );

  // 8. Unlock classified PRO + SERVER
  const unlockAccess = getToolAccess("unlock-pdf");
  assert(
    "8 unlock-pdf is PRO + SERVER in tool-access",
    unlockAccess?.requiresPro === true && unlockAccess.processing === "server",
  );

  // 9. pdf-to-word tier matches entitlement truth
  const pdfToWordAccess = getToolAccess("pdf-to-word");
  const pdfGridItem = HOMEPAGE_CATEGORY_GRIDS.pdf.find(
    (tool) => tool.id === "pdf-to-word",
  );
  assert(
    "9 pdf-to-word requiresPro matches homepage grid badge",
    pdfToWordAccess?.requiresPro === true && pdfGridItem?.proOnly === true,
  );

  // 10. AI tool badges match entitlement truth
  const aiProTools = ["ai-translate", "ai-summary", "ai-rewrite"] as const;
  for (const toolId of aiProTools) {
    const access = getToolAccess(toolId);
    const gridItem = HOMEPAGE_CATEGORY_GRIDS.ai.find((tool) => tool.id === toolId);
    assert(
      `10 ${toolId} requiresPro matches homepage grid badge`,
      access?.requiresPro === true && gridItem?.proOnly === true,
    );
  }

  // 11. search contains webp-to-png
  const searchMatches = searchHomeTools("webp to png");
  assert(
    "11 search contains webp-to-png",
    searchMatches.some((tool) => tool.id === "webp-to-png"),
  );

  // 12. Find a Tool parity
  const finderMatches = findTools("webp to png").matches;
  assert(
    "12 Find a Tool contains webp-to-png",
    finderMatches.some((match) => match.tool.id === "webp-to-png"),
  );
  const finderIds = new Set(
    HOMEPAGE_TOOLS.filter((tool) => tool.available && tool.id !== "website-monitoring")
      .map((tool) => tool.id),
  );
  const directorySet = new Set(directoryIds);
  assert(
    "12 Find a Tool parity with directory (excluding aliases)",
    [...directorySet].every((id) => finderIds.has(id)),
  );

  // 13. no duplicate canonical slug
  assert(
    "13 no duplicate canonical slug in directory",
    new Set(directoryIds).size === directoryIds.length,
  );
  assert(
    "13 no duplicate canonical slug in homepage tools",
    new Set(availableHomepageIds).size === availableHomepageIds.length,
  );

  // 14. no duplicate route
  const directoryRoutes = SCANONIX_TOOLS.map((tool) => tool.href);
  assert(
    "14 no duplicate route in directory",
    new Set(directoryRoutes).size === directoryRoutes.length,
  );

  // 15. every canonical tool has one primary category
  const uncategorized = SCANONIX_TOOLS.filter((tool) => {
    const meta = getToolCategoryMeta(tool.id);
    return !meta || tool.category !== meta.primaryCategory;
  });
  assert(
    "15 every directory tool has one primary category",
    uncategorized.length === 0,
    uncategorized.map((tool) => tool.id).join(", "),
  );
  assert(
    "15 directory category filters include security",
    TOOL_CATEGORY_FILTERS.some((filter) => filter.id === "security"),
  );
  const securityScan = SCANONIX_TOOLS.find((tool) => tool.id === "security-scan");
  assert(
    "15 security-scan primary category is security",
    securityScan?.category === "security",
  );
  const protectPdf = SCANONIX_TOOLS.find((tool) => tool.id === "protect-pdf");
  assert(
    "15 protect-pdf primary category is pdf with security subcategory",
    protectPdf?.category === "pdf" &&
      getToolCategoryMeta("protect-pdf")?.pdfSubcategory === "security",
  );
  assert(
    "15 protect-pdf appears in security filter",
    toolMatchesCategoryFilter("protect-pdf", "security"),
  );

  // 16. processing metadata matches current tool-access truth
  let processingMismatch = "";
  for (const tool of SCANONIX_TOOLS) {
    const access = getToolAccess(tool.id);
    if (!access || !tool.privacyBadge) continue;

    const expectedPrefix = access.requiresPro ? "Pro · " : "";
    const expectedSuffix =
      access.processing === "client"
        ? "Processed in your browser"
        : "Secure server processing";
    const expected = `${expectedPrefix}${expectedSuffix}`;

    if (tool.privacyBadge !== expected) {
      processingMismatch = `${tool.id}: expected "${expected}", got "${tool.privacyBadge}"`;
      break;
    }
  }
  assert(
    "16 processing metadata matches tool-access truth",
    processingMismatch === "",
    processingMismatch,
  );

  // 17. unavailable tools do not appear as live
  const unavailableInDirectory = SCANONIX_TOOLS.filter((tool) => {
    const homepage = HOMEPAGE_TOOLS.find((entry) => entry.id === tool.id);
    return !homepage?.available;
  });
  assert(
    "17 unavailable tools do not appear in directory",
    unavailableInDirectory.length === 0,
  );

  // 18. temp routes absent from sitemap/discovery
  const tempRoutes = canonicalSlugs.filter((slug) =>
    TEMP_ROUTE_SUFFIXES.some((suffix) => slug.endsWith(suffix)),
  );
  assert(
    "18 temp routes excluded from canonical inventory",
    tempRoutes.length === 0,
  );

  const sitemapSource = readFileSync(join(root, "app", "sitemap.ts"), "utf8");
  assert(
    "18 sitemap uses INDEXABLE_TOOL_PATHS only",
    sitemapSource.includes("INDEXABLE_TOOL_PATHS"),
  );

  for (const tempSlug of ["redact-pdf-client", "watermark-pdf-client"]) {
    assert(
      `18 temp route absent from sitemap paths (${tempSlug})`,
      !INDEXABLE_TOOL_PATHS.includes(`/tools/${tempSlug}`),
    );
    assert(
      `18 temp route absent from directory (${tempSlug})`,
      !directoryIds.includes(tempSlug),
    );
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
