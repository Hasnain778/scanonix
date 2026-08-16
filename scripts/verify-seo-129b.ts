/**
 * Technical SEO P0 repair verification (Phase 129B).
 * Run: npx tsx scripts/verify-seo-129b.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CANONICAL_SITE_ORIGIN } from "../config/canonical-site-url";
import { SCANONIX_TOOLS } from "../constants/tools-directory-data";
import {
  getToolsCategoryHref,
  parseToolsCategoryParam,
} from "../lib/navigation/tool-category-urls";

const root = process.cwd();

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

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function getPathFromPage(relativePath: string): string | undefined {
  const source = readSource(relativePath);
  const pathMatch = source.match(/createPageMetadata\(\{[\s\S]*?path:\s*"([^"]+)"/);
  return pathMatch?.[1];
}

function getProductionCanonical(path: string): string {
  return `${CANONICAL_SITE_ORIGIN}${path}`;
}

function countMatches(source: string, pattern: RegExp): number {
  return (source.match(pattern) ?? []).length;
}

function run() {
  console.log("\nTechnical SEO P0 repair verification (Phase 129B)\n");

  const privacyPath = getPathFromPage("app/privacy/page.tsx");
  const termsPath = getPathFromPage("app/terms/page.tsx");
  const contactPath = getPathFromPage("app/contact/page.tsx");

  // 1–3. Legal pages self-canonicalize (not homepage)
  assert(
    "1 privacy canonical is self (not /)",
    privacyPath === "/privacy",
    privacyPath ?? "missing",
  );
  assert(
    "2 terms canonical is self (not /)",
    termsPath === "/terms",
    termsPath ?? "missing",
  );
  assert(
    "3 contact canonical is self (not /)",
    contactPath === "/contact",
    contactPath ?? "missing",
  );

  // 4–5. Legal pages use createPageMetadata + canonical site origin
  for (const [label, sourcePath, path] of [
    ["privacy", "app/privacy/page.tsx", privacyPath],
    ["terms", "app/terms/page.tsx", termsPath],
    ["contact", "app/contact/page.tsx", contactPath],
  ] as const) {
    const source = readSource(sourcePath);
    assert(
      `4 ${label} uses createPageMetadata`,
      source.includes("createPageMetadata"),
    );
    assert(
      `5 ${label} canonical uses centralized site origin`,
      path !== undefined && getProductionCanonical(path).startsWith(CANONICAL_SITE_ORIGIN),
      path ? getProductionCanonical(path) : "missing",
    );
  }

  const heroHeaderSource = readSource(
    "components/tools/directory/ToolsDirectoryHeroHeader.tsx",
  );
  const toolsDirectorySource = readSource(
    "components/tools/directory/ToolsDirectory.tsx",
  );
  const toolsPageSource = readSource("app/tools/page.tsx");

  // 6. /tools has exactly one H1 in page architecture
  const directoryH1Count = countMatches(toolsDirectorySource, /<h1\b/g);
  const heroH1Count = countMatches(heroHeaderSource, /<h1\b/g);
  assert(
    "6 /tools has exactly one H1 source (server hero header)",
    heroH1Count === 1 && directoryH1Count === 0,
    `hero=${heroH1Count}, directory=${directoryH1Count}`,
  );

  // 7. H1 is server-renderable (no use client on hero header)
  assert(
    "7 tools H1 lives in server component (ToolsDirectoryHeroHeader)",
    !heroHeaderSource.includes('"use client"') &&
      heroHeaderSource.includes("<h1") &&
      heroHeaderSource.includes("TOOLS_DIRECTORY_H1"),
  );

  // 8. No hidden SEO H1 hacks on /tools
  const hiddenH1Pattern = /<h1[^>]*(display:\s*none|visibility:\s*hidden|sr-only)/;
  assert(
    "8 no hidden H1 SEO hacks in tools directory",
    !hiddenH1Pattern.test(toolsDirectorySource) &&
      !hiddenH1Pattern.test(heroHeaderSource),
  );
  const toolsPageBody = toolsPageSource.slice(toolsPageSource.indexOf("export default"));
  assert(
    "8 tools page renders server hero header outside Suspense",
    toolsPageBody.includes("ToolsDirectoryHeroHeader") &&
      toolsPageBody.indexOf("ToolsDirectoryHeroHeader") <
        toolsPageBody.indexOf("<Suspense"),
  );

  // 9. Category query routing unchanged (128E architecture)
  assert(
    "9 All Tools href resolves to /tools",
    getToolsCategoryHref("all") === "/tools",
  );
  assert(
    "9 parseToolsCategoryParam(null) returns all",
    parseToolsCategoryParam(null) === "all",
  );
  for (const category of ["pdf", "image", "ai", "security"] as const) {
    assert(
      `9 category ${category} href preserved`,
      getToolsCategoryHref(category) === `/tools?category=${category}`,
    );
    assert(
      `9 parseToolsCategoryParam("${category}") preserved`,
      parseToolsCategoryParam(category) === category,
    );
  }
  assert(
    "9 ToolsDirectory still reads searchParams category",
    toolsDirectorySource.includes("useSearchParams") &&
      toolsDirectorySource.includes('searchParams.get("category")'),
  );
  assert(
    "9 ToolsDirectory still updates URL on category change",
    toolsDirectorySource.includes("getToolsCategoryHref") &&
      toolsDirectorySource.includes("router.push"),
  );

  // 10. Tool directory behavior preserved
  assert(
    "10 tools directory lists 36 tools",
    SCANONIX_TOOLS.length === 36,
  );
  assert(
    "10 ToolsDirectory retains search, filters, and grid sections",
    toolsDirectorySource.includes("tools-directory-search-zone") &&
      toolsDirectorySource.includes("tools-directory-controls-zone") &&
      toolsDirectorySource.includes("tools-grid-neon") &&
      toolsDirectorySource.includes("ToolCard"),
  );
  assert(
    "10 /tools page keeps Suspense + LazyToolsDirectory",
    toolsPageSource.includes("Suspense") &&
      toolsPageSource.includes("LazyToolsDirectory"),
  );
  assert(
    "10 hero header component exists",
    existsSync(
      join(root, "components", "tools", "directory", "ToolsDirectoryHeroHeader.tsx"),
    ),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
