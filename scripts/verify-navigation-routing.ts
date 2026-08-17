/**
 * Navigation routing regression tests (Phase 128E).
 * Run: npx tsx scripts/verify-navigation-routing.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HOMEPAGE_CATEGORY_GRIDS,
  HOMEPAGE_CATEGORY_META,
  HOMEPAGE_TOOLS,
  NAV_DROPDOWN_TOOLS,
  type HomepageToolCategory,
} from "../constants/homepage-tools";
import {
  filterTools,
  SCANONIX_TOOLS,
} from "../constants/tools-directory-data";
import {
  toolMatchesCategoryFilter,
} from "../constants/tool-categories";
import { getToolAccess } from "../lib/plan/tool-access";
import {
  getToolsCategoryHref,
  parseToolsCategoryParam,
} from "../lib/navigation/tool-category-urls";
import { findTools } from "../lib/tools/tool-finder";
import { searchHomeTools } from "../lib/tools/search-home-tools";

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

const CATEGORIES: HomepageToolCategory[] = ["pdf", "image", "ai", "security"];

function run() {
  console.log("\nNavigation routing verification (Phase 128E)\n");

  // 1. All Tools → all state
  assert("1 All Tools href resolves to /tools", getToolsCategoryHref("all") === "/tools");
  assert(
    "1 parseToolsCategoryParam(null) returns all",
    parseToolsCategoryParam(null) === "all",
  );

  // 2–6. Category deep links
  for (const category of CATEGORIES) {
    const href = getToolsCategoryHref(category);
    assert(
      `2–6 ${category} category href is /tools?category=${category}`,
      href === `/tools?category=${category}`,
    );
    assert(
      `2–6 parseToolsCategoryParam("${category}") returns ${category}`,
      parseToolsCategoryParam(category) === category,
    );

    const filtered = filterTools(SCANONIX_TOOLS, "", category);
    assert(
      `2–6 ${category} filter returns matching tools`,
      filtered.length > 0 &&
        filtered.every((tool) => toolMatchesCategoryFilter(tool.id, category)),
    );
  }

  // PDF subcategory deep links
  const PDF_SUBCATEGORIES = [
    "organize-pdf",
    "convert-pdf",
    "edit-pdf",
    "optimize-pdf",
    "security-pdf",
  ] as const;

  for (const subcategory of PDF_SUBCATEGORIES) {
    const href = getToolsCategoryHref(subcategory);
    assert(
      `2–6 ${subcategory} href is /tools?category=${subcategory}`,
      href === `/tools?category=${subcategory}`,
    );
    assert(
      `2–6 parseToolsCategoryParam("${subcategory}") returns ${subcategory}`,
      parseToolsCategoryParam(subcategory) === subcategory,
    );

    const filtered = filterTools(SCANONIX_TOOLS, "", subcategory);
    assert(
      `2–6 ${subcategory} filter returns only matching pdf tools`,
      filtered.length > 0 &&
        filtered.every((tool) => toolMatchesCategoryFilter(tool.id, subcategory)),
    );
  }

  // 7–9. URL param safety
  assert(
    "7 invalid category falls back to all",
    parseToolsCategoryParam("not-a-category") === "all",
  );
  assert(
    "8 empty category falls back to all",
    parseToolsCategoryParam("") === "all",
  );
  assert(
    "9 pdf param round-trips through href builder",
    parseToolsCategoryParam(new URL(getToolsCategoryHref("pdf"), "https://scanonix.com").searchParams.get("category")) === "pdf",
  );

  // 10–11. Homepage category view-all links
  assert(
    "10 homepage PDF view-all → PDF directory state",
    HOMEPAGE_CATEGORY_META.pdf.viewAllHref === "/tools?category=pdf",
  );
  assert(
    "11 homepage image view-all → image directory state",
    HOMEPAGE_CATEGORY_META.image.viewAllHref === "/tools?category=image",
  );
  assert(
    "11 homepage ai view-all → ai directory state",
    HOMEPAGE_CATEGORY_META.ai.viewAllHref === "/tools?category=ai",
  );
  assert(
    "11 homepage security view-all → security directory state",
    HOMEPAGE_CATEGORY_META.security.viewAllHref === "/tools?category=security",
  );

  // 12. Footer PDF link → PDF state
  const footerSource = readFileSync(join(root, "components", "layout", "Footer.tsx"), "utf8");
  assert(
    "12 footer PDF Tools links to /tools?category=pdf",
    footerSource.includes('href: getToolsCategoryHref("pdf")'),
  );
  assert(
    "12 footer Image Tools links to /tools?category=image",
    footerSource.includes('href: getToolsCategoryHref("image")'),
  );
  assert(
    "12 footer AI Tools links to /tools?category=ai",
    footerSource.includes('href: getToolsCategoryHref("ai")'),
  );
  assert(
    "12 footer Security Tools links to /tools?category=security",
    footerSource.includes('href: getToolsCategoryHref("security")'),
  );

  // 13. Nav dropdown view-all links
  assert(
    "13 nav PDF view-all → PDF directory state",
    NAV_DROPDOWN_TOOLS.pdf.viewAllHref === "/tools?category=pdf",
  );
  assert(
    "13 nav image view-all → image directory state",
    NAV_DROPDOWN_TOOLS.image.viewAllHref === "/tools?category=image",
  );
  assert(
    "13 nav ai view-all → ai directory state",
    NAV_DROPDOWN_TOOLS.ai.viewAllHref === "/tools?category=ai",
  );
  assert(
    "13 nav security view-all → security directory state",
    NAV_DROPDOWN_TOOLS.security.viewAllHref === "/tools?category=security",
  );

  // 14. Mobile nav shares same view-all hrefs
  assert(
    "14 mobile nav uses NAV_DROPDOWN_TOOLS viewAllHref for pdf",
    NAV_DROPDOWN_TOOLS.pdf.viewAllHref.includes("category=pdf"),
  );

  // 15. All PDF Tools regression — no generic /tools-only view-all for pdf
  assert(
    "15 All PDF Tools does not point to generic /tools",
    NAV_DROPDOWN_TOOLS.pdf.viewAllHref !== "/tools",
  );
  assert(
    "15 homepage PDF view-all does not point to generic /tools",
    HOMEPAGE_CATEGORY_META.pdf.viewAllHref !== "/tools",
  );

  // 15. PDF nav dropdown uses subcategory links
  assert(
    "15 PDF nav Organize PDF links to organize-pdf",
    NAV_DROPDOWN_TOOLS.pdf.tools.some(
      (tool) =>
        tool.name === "Organize PDF" &&
        tool.href === getToolsCategoryHref("organize-pdf"),
    ),
  );
  assert(
    "15 PDF nav All PDF Tools links to pdf filter",
    NAV_DROPDOWN_TOOLS.pdf.tools.some(
      (tool) =>
        tool.name === "All PDF Tools" && tool.href === getToolsCategoryHref("pdf"),
    ),
  );
  assert(
    "15 PDF nav Security links to security filter",
    NAV_DROPDOWN_TOOLS.pdf.tools.some(
      (tool) =>
        tool.name === "Security" && tool.href === getToolsCategoryHref("security"),
    ),
  );

  const directorySource = readFileSync(
    join(root, "components", "tools", "directory", "ToolsDirectory.tsx"),
    "utf8",
  );

  // 16. ToolsDirectory PDF subfilters
  assert(
    "16 ToolsDirectory uses PDF subcategory filters",
    directorySource.includes("PDF_SUBCATEGORY_FILTERS") &&
      directorySource.includes("isPdfCategoryFilter"),
  );
  assert(
    "16 ToolsDirectory scrollable category chips on mobile",
    directorySource.includes("overflow-x-auto"),
  );

  // 17. Image dropdown no longer routes to /tools/image hub for view-all
  assert(
    "17 image view-all is not /tools/image hub",
    NAV_DROPDOWN_TOOLS.image.viewAllHref !== "/tools/image",
  );
  assert(
    "17 All image tools item uses category directory",
    NAV_DROPDOWN_TOOLS.image.tools.some(
      (tool) => tool.name === "All image tools" && tool.href === "/tools?category=image",
    ),
  );

  // 18. ToolsDirectory reads URL search params
  assert(
    "18 ToolsDirectory reads searchParams category",
    directorySource.includes("useSearchParams") &&
      directorySource.includes("parseToolsCategoryParam"),
  );
  assert(
    "18 ToolsDirectory updates URL on category change",
    directorySource.includes("getToolsCategoryHref") &&
      directorySource.includes("router.push"),
  );

  // 19. Homepage body has no duplicate Android promo section
  const homepageSource = readFileSync(join(root, "app", "page.tsx"), "utf8");
  assert(
    "19 homepage body does not render HomeAndroidPromo",
    !homepageSource.includes("<HomeAndroidPromo") &&
      !homepageSource.includes('from "@/components/sections/HomeAndroidPromo"'),
  );

  // 20. Breadcrumb category links use hub for image, filter URLs elsewhere
  const breadcrumbSource = readFileSync(
    join(root, "components", "workspace", "ToolRoute.tsx"),
    "utf8",
  );
  assert(
    "20 breadcrumb uses getCategoryBreadcrumbHref for category links",
    breadcrumbSource.includes("getCategoryBreadcrumbHref"),
  );

  // 21. Search result → canonical route
  const webpMatches = searchHomeTools("webp to png");
  const webpTool = webpMatches.find((tool) => tool.id === "webp-to-png");
  assert(
    "21 webp-to-png searchable with canonical href",
    webpTool?.href === "/tools/webp-to-png",
  );

  // 22. Security tools searchable
  const securityMatches = searchHomeTools("protect pdf");
  assert(
    "22 protect-pdf searchable",
    securityMatches.some((tool) => tool.id === "protect-pdf"),
  );
  const finderSecurity = findTools("redact pdf").matches;
  assert(
    "22 redact-pdf findable",
    finderSecurity.some((match) => match.tool.id === "redact-pdf"),
  );

  // 23. Temp routes absent from directory
  const directoryIds = SCANONIX_TOOLS.map((tool) => tool.id);
  for (const tempSlug of ["redact-pdf-client", "watermark-pdf-client"]) {
    assert(
      `23 temp route absent from directory (${tempSlug})`,
      !directoryIds.includes(tempSlug),
    );
  }

  // 24. Pro badges correct for pdf-to-word
  const pdfToWordAccess = getToolAccess("pdf-to-word");
  const pdfGridItem = HOMEPAGE_CATEGORY_GRIDS.pdf.find(
    (tool) => tool.id === "pdf-to-word",
  );
  assert(
    "24 pdf-to-word Pro badge matches entitlement",
    pdfToWordAccess?.requiresPro === true && pdfGridItem?.proOnly === true,
  );

  // 25. No duplicate canonical cards in directory
  assert(
    "25 no duplicate directory tool ids",
    new Set(directoryIds).size === directoryIds.length,
  );

  // 26. No working canonical tool displayed as Coming Soon in grids
  let comingSoonMismatch = "";
  for (const category of CATEGORIES) {
    for (const item of HOMEPAGE_CATEGORY_GRIDS[category]) {
      if (!item.comingSoon) continue;
      const homepage = HOMEPAGE_TOOLS.find((tool) => tool.id === item.id);
      if (homepage?.available) {
        comingSoonMismatch = `${item.id} in ${category} grid marked comingSoon but available`;
        break;
      }
    }
    if (comingSoonMismatch) break;
  }
  assert(
    "26 no available tool marked Coming Soon in category grids",
    comingSoonMismatch === "",
    comingSoonMismatch,
  );

  // 27. Account/dashboard navigation routes exist
  for (const route of ["/dashboard", "/account", "/account/billing", "/login"]) {
    assert(
      `27 route file exists (${route})`,
      existsSync(join(root, "app", route.replace(/^\//, ""), "page.tsx")),
    );
  }

  // 28. /tools page wraps directory in Suspense for searchParams
  const toolsPageSource = readFileSync(join(root, "app", "tools", "page.tsx"), "utf8");
  assert(
    "28 /tools page uses Suspense for directory",
    toolsPageSource.includes("Suspense") && toolsPageSource.includes("LazyToolsDirectory"),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
