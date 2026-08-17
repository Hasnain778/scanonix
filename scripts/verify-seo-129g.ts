/**
 * Image hub discoverability + internal linking verification (Phase 129G).
 * Run: npx tsx scripts/verify-seo-129g.ts
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HOMEPAGE_CATEGORY_META,
  NAV_DROPDOWN_TOOLS,
} from "../constants/homepage-tools";
import {
  IMAGE_FORMAT_CLUSTERS,
  IMAGE_TOOL_IDS,
  IMAGE_TOOLS_HUB_PATH,
  validateImageRelatedToolIds,
} from "../constants/image-tool-relationships";
import { TOOL_CATEGORY_MATRIX } from "../constants/tool-categories";
import { INDEXABLE_TOOL_PATHS, TOOL_SEO } from "../constants/tool-seo";
import { getToolsCategoryHref } from "../lib/navigation/tool-category-urls";

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

function countInboundHubLinks(): number {
  const skipDirs = new Set(["node_modules", ".next", ".git"]);
  let count = 0;

  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") && entry.name !== ".") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        walk(full);
        continue;
      }
      if (!/\.(tsx?|jsx?|mdx?)$/.test(entry.name)) continue;
      const source = readFileSync(full, "utf8");
      if (source.includes(IMAGE_TOOLS_HUB_PATH)) {
        count += 1;
      }
    }
  }

  walk(root);
  return count;
}

function run() {
  console.log("\nImage hub + internal linking verification (Phase 129G)\n");

  // 1. Hub route + SEO entry
  assert(
    "1 image hub page exists",
    existsSync(join(root, "app", "tools", "image", "page.tsx")),
  );
  assert(
    "1 TOOL_SEO image hub entry uses /tools/image",
    TOOL_SEO.image?.path === IMAGE_TOOLS_HUB_PATH,
  );
  assert(
    "1 image hub is indexable",
    INDEXABLE_TOOL_PATHS.includes(IMAGE_TOOLS_HUB_PATH),
  );

  const hubPageSource = readSource("app/tools/image/page.tsx");
  assert(
    "1 image hub renders ImageToolsHub + ToolSeoContent",
    hubPageSource.includes("ImageToolsHub") && hubPageSource.includes('toolId="image"'),
  );

  // 2. Image tool inventory (matrix + converters)
  assert(
    "2 image category matrix lists 12 workspace tools",
    IMAGE_TOOL_IDS.length === 12,
    IMAGE_TOOL_IDS.join(", "),
  );

  const matrixImageIds = TOOL_CATEGORY_MATRIX.filter(
    (entry) => entry.primaryCategory === "image",
  ).map((entry) => entry.toolId);
  assert(
    "2 IMAGE_TOOL_IDS matches category matrix",
    matrixImageIds.every((id) => (IMAGE_TOOL_IDS as readonly string[]).includes(id)),
  );

  for (const clusterName of Object.keys(IMAGE_FORMAT_CLUSTERS)) {
    const cluster = IMAGE_FORMAT_CLUSTERS[clusterName as keyof typeof IMAGE_FORMAT_CLUSTERS];
    assert(
      `2 ${clusterName} cluster ids are image tools`,
      cluster.every((id) => (IMAGE_TOOL_IDS as readonly string[]).includes(id)),
      cluster.join(", "),
    );
  }

  // 3. Preserve ?category= URLs for nav/footer/meta (128E)
  assert(
    "3 homepage meta image viewAllHref stays on directory filter",
    HOMEPAGE_CATEGORY_META.image.viewAllHref === getToolsCategoryHref("image"),
  );
  assert(
    "3 nav image viewAllHref stays on directory filter",
    NAV_DROPDOWN_TOOLS.image.viewAllHref === getToolsCategoryHref("image"),
  );

  const footerSource = readSource("components/layout/Footer.tsx");
  assert(
    "3 footer Image Tools uses getToolsCategoryHref(image)",
    footerSource.includes('getToolsCategoryHref("image")'),
  );

  // 4. New crawl paths to hub
  const homepageSource = readSource("components/home/PopularToolsSection.tsx");
  assert(
    "4 homepage image category card links to image hub",
    homepageSource.includes("getImageToolsHubHref()") &&
      homepageSource.includes('category === "image"'),
  );

  const directorySource = readSource("components/tools/directory/ToolsDirectory.tsx");
  assert(
    "4 tools directory links to image hub when image filter active",
    directorySource.includes("getImageToolsHubHref()") &&
      directorySource.includes('category === "image"'),
  );

  // 5. Image tool breadcrumbs link to hub
  const toolRouteSource = readSource("components/workspace/ToolRoute.tsx");
  assert(
    "5 ToolRoute uses getCategoryBreadcrumbHref",
    toolRouteSource.includes("getCategoryBreadcrumbHref"),
  );

  const converterPageSource = readSource("lib/image-tools/create-converter-page.tsx");
  assert(
    "5 converter JSON-LD breadcrumb includes Image Tools hub",
    converterPageSource.includes("IMAGE_TOOLS_HUB_PATH") &&
      converterPageSource.includes('"Image Tools"'),
  );

  // 6. Related tools — 3–5 per image tool, resolvable
  for (const toolId of IMAGE_TOOL_IDS) {
    const seo = TOOL_SEO[toolId];
    assert(`6 ${toolId} has TOOL_SEO entry`, Boolean(seo));

    const validation = validateImageRelatedToolIds(toolId, seo.relatedToolIds);
    assert(
      `6 ${toolId} related tools count valid`,
      validation.ok,
      validation.ok ? "" : validation.reason,
    );

    for (const relatedId of seo.relatedToolIds) {
      assert(
        `6 ${toolId} related id ${relatedId} resolves`,
        Boolean(TOOL_SEO[relatedId]),
      );
    }
  }

  // 7. Hub related tools
  const hubRelated = TOOL_SEO.image?.relatedToolIds ?? [];
  assert(
    "7 image hub has 3–5 related tools",
    hubRelated.length >= 3 && hubRelated.length <= 5,
    String(hubRelated.length),
  );

  // 8. PDF / AI / Security architecture untouched
  assert(
    "8 PDF tools remain pdf primary category",
    TOOL_CATEGORY_MATRIX.filter((entry) => entry.primaryCategory === "pdf").length === 18,
  );
  assert(
    "8 AI tools remain ai primary category",
    TOOL_CATEGORY_MATRIX.filter((entry) => entry.primaryCategory === "ai").length === 5,
  );
  assert(
    "8 security-scan remains security category",
    TOOL_CATEGORY_MATRIX.some(
      (entry) => entry.toolId === "security-scan" && entry.primaryCategory === "security",
    ),
  );
  assert(
    "8 no /tools/pdf hub route introduced",
    !existsSync(join(root, "app", "tools", "pdf", "page.tsx")),
  );

  // 9. Preserve 129F WEBP / HEIC SEO copy markers
  const webpSeo = TOOL_SEO["webp-to-png"];
  assert(
    "9 webp-to-png 129F useCases preserved",
    (webpSeo.useCases?.length ?? 0) >= 3 && webpSeo.pageDescription.length >= 120,
  );
  const heicSeo = TOOL_SEO["heic-to-png"];
  assert(
    "9 heic-to-png 129F content depth preserved",
    (heicSeo.useCases?.length ?? 0) >= 3 && heicSeo.faqs.length >= 4,
  );

  // 10. Inbound link footprint
  const inboundFileCount = countInboundHubLinks();
  assert(
    "10 inbound /tools/image references meet minimum crawl paths",
    inboundFileCount >= 6,
    `found in ${inboundFileCount} source files`,
  );

  console.log(`\nInbound /tools/image reference files: ${inboundFileCount}`);
  console.log(`${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
