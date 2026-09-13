/**
 * Phase 130L-4 — Homepage category discovery:
 * All = curated popular; PDF/Image/AI = full canonical SCANONIX_TOOLS via filterTools.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getPopularTools,
  getToolById,
  HOMEPAGE_CATEGORY_META,
  POPULAR_TOOL_IDS,
} from "../constants/homepage-tools";
import { filterTools, SCANONIX_TOOLS } from "../constants/tools-directory-data";

const root = process.cwd();

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.error(`✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function canonicalIds(category: "pdf" | "image" | "ai" | "security"): string[] {
  return filterTools(SCANONIX_TOOLS, "", category).map((tool) => tool.id);
}

function main(): void {
  console.log("\nHomepage category discovery verification (Phase 130L-4)\n");

  const discoverySource = readFileSync(
    join(root, "components", "home", "HomeToolDiscovery.tsx"),
    "utf8",
  );
  const navSource = readFileSync(
    join(root, "components", "home", "HomeCategoryNav.tsx"),
    "utf8",
  );

  assert(
    "1 discovery uses filterTools + SCANONIX_TOOLS for filtered categories",
    discoverySource.includes("filterTools") &&
      discoverySource.includes("SCANONIX_TOOLS") &&
      discoverySource.includes("getCanonicalCategoryTools"),
  );

  assert(
    "2 All view still receives curated popular tools prop",
    discoverySource.includes('activeCategory === "all"') &&
      discoverySource.includes("return tools"),
  );

  assert(
    "3 filtered views hide Browse-all escape hatch",
    discoverySource.includes("showBrowseAll") &&
      discoverySource.includes('activeCategory === "all"') &&
      /showBrowseAll\s*=\s*activeCategory\s*===\s*"all"/.test(discoverySource),
  );

  assert(
    "4 no duplicated HOMEPAGE_ALL_* inventory constants",
    !discoverySource.includes("HOMEPAGE_ALL_PDF") &&
      !discoverySource.includes("HOMEPAGE_ALL_IMAGE") &&
      !discoverySource.includes("HOMEPAGE_ALL_AI"),
  );

  assert(
    "5 Security tab not added to homepage category nav",
    !navSource.includes('id: "security"') &&
      navSource.includes('id: "pdf"') &&
      navSource.includes('id: "image"') &&
      navSource.includes('id: "ai"'),
  );

  const popular = getPopularTools();
  assert(
    "6 All curated count matches POPULAR_TOOL_IDS",
    popular.length === POPULAR_TOOL_IDS.length && popular.length === 8,
    `got ${popular.length}`,
  );

  const pdf = canonicalIds("pdf");
  const image = canonicalIds("image");
  const ai = canonicalIds("ai");
  const security = canonicalIds("security");

  assert("7 PDF canonical count is 18", pdf.length === 18, `got ${pdf.length}`);
  assert("8 Image canonical count is 12", image.length === 12, `got ${image.length}`);
  assert("9 AI canonical count is 5", ai.length === 5, `got ${ai.length}`);
  assert("10 Security canonical count is 5", security.length === 5, `got ${security.length}`);
  assert("11 directory total remains 36", SCANONIX_TOOLS.length === 36);

  for (const [label, ids] of [
    ["PDF", pdf],
    ["Image", image],
    ["AI", ai],
  ] as const) {
    const hrefs = ids.map((id) => getToolById(id)?.href);
    assert(
      `12 ${label} tools resolve to HomepageTool + href`,
      hrefs.every((href) => typeof href === "string" && href.startsWith("/tools/")),
    );
    assert(
      `13 ${label} hrefs unique`,
      new Set(hrefs).size === hrefs.length,
    );
    assert(
      `14 ${label} ids unique`,
      new Set(ids).size === ids.length,
    );
  }

  assert(
    "15 PDF view-all meta still points at /tools?category=pdf",
    HOMEPAGE_CATEGORY_META.pdf.viewAllHref === "/tools?category=pdf",
  );
  assert(
    "16 Image view-all meta still points at /tools?category=image",
    HOMEPAGE_CATEGORY_META.image.viewAllHref === "/tools?category=image",
  );
  assert(
    "17 AI view-all meta still points at /tools?category=ai",
    HOMEPAGE_CATEGORY_META.ai.viewAllHref === "/tools?category=ai",
  );

  assert(
    "18 discovery does not import HOMEPAGE_CATEGORY_GRIDS for filtered lists",
    !discoverySource.includes("HOMEPAGE_CATEGORY_GRIDS"),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main();
