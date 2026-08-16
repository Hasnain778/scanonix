/**
 * Tool category matrix verification (Phase 128E-FIX1).
 * Run: npx tsx scripts/verify-tool-category-matrix.ts
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  CANONICAL_TOOL_IDS,
  getToolCategoryMeta,
  PDF_SUBCATEGORY_FILTERS,
  toolMatchesCategoryFilter,
  TOOL_CATEGORY_MATRIX,
  TOP_LEVEL_CATEGORY_FILTERS,
  type ToolCategoryFilterId,
} from "../constants/tool-categories";
import { SCANONIX_TOOLS } from "../constants/tools-directory-data";
import { getToolAccess } from "../lib/plan/tool-access";
import { getToolsCategoryHref, parseToolsCategoryParam } from "../lib/navigation/tool-category-urls";

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

function tierLabel(toolId: string): string {
  const access = getToolAccess(toolId);
  if (!access) return "unknown";
  if (access.requiresPremiumAi) return "premium-ai";
  if (access.requiresPro) return "pro";
  return "free";
}

function run() {
  console.log("\nTool category matrix verification (Phase 128E-FIX1)\n");

  const canonicalSlugs = listCanonicalToolSlugs();
  const directoryIds = SCANONIX_TOOLS.map((tool) => tool.id).sort();

  console.log("TOOL | PRIMARY CATEGORY | PDF SUBCATEGORY | TIER | PROCESSING | ROUTE");
  console.log("-".repeat(90));

  for (const toolId of CANONICAL_TOOL_IDS.sort()) {
    const meta = getToolCategoryMeta(toolId)!;
    const access = getToolAccess(toolId);
    const route = access?.route ? `/tools/${access.route}` : "—";
    const processing = access?.processing ?? "—";
    const tier = tierLabel(toolId);
    const pdfSub = meta.pdfSubcategory ?? "—";

    console.log(
      `${toolId} | ${meta.primaryCategory} | ${pdfSub} | ${tier} | ${processing} | ${route}`,
    );
  }

  console.log("");

  // 1. Matrix covers all 36 canonical tools
  assert(
    "1 matrix contains 36 canonical tools",
    TOOL_CATEGORY_MATRIX.length === 36,
    `got ${TOOL_CATEGORY_MATRIX.length}`,
  );

  assert(
    "1 matrix ids match filesystem routes",
    CANONICAL_TOOL_IDS.sort().join(",") === canonicalSlugs.join(","),
  );

  // 2. Every directory tool in All
  assert(
    "2 every directory tool appears in All filter",
    directoryIds.every((id) => toolMatchesCategoryFilter(id, "all")),
  );

  // 3. Every directory tool in its primary category (or security for pdf-security)
  let primaryMismatch = "";
  for (const tool of SCANONIX_TOOLS) {
    const meta = getToolCategoryMeta(tool.id);
    if (!meta) {
      primaryMismatch = `${tool.id} missing matrix entry`;
      break;
    }
    if (tool.category !== meta.primaryCategory) {
      primaryMismatch = `${tool.id}: directory category ${tool.category} != ${meta.primaryCategory}`;
      break;
    }
  }
  assert("3 directory primary category matches matrix", primaryMismatch === "", primaryMismatch);

  // 4. Tools not in wrong top-level categories
  const categoryChecks: Array<{ filter: ToolCategoryFilterId; expectedCount: number }> = [
    { filter: "pdf", expectedCount: 18 },
    { filter: "image", expectedCount: 12 },
    { filter: "ai", expectedCount: 5 },
    { filter: "security", expectedCount: 5 },
  ];

  for (const check of categoryChecks) {
    const matched = directoryIds.filter((id) => toolMatchesCategoryFilter(id, check.filter));
    assert(
      `4 ${check.filter} filter has ${check.expectedCount} tools`,
      matched.length === check.expectedCount,
      `got ${matched.length}: ${matched.join(", ")}`,
    );
  }

  // 5. PDF subcategory counts
  const pdfSubCounts: Record<string, number> = {
    "organize-pdf": 4,
    "convert-pdf": 4,
    "edit-pdf": 5,
    "optimize-pdf": 1,
    "security-pdf": 4,
  };

  for (const [filterId, expected] of Object.entries(pdfSubCounts)) {
    const matched = directoryIds.filter((id) =>
      toolMatchesCategoryFilter(id, filterId as ToolCategoryFilterId),
    );
    assert(
      `5 ${filterId} subfilter has ${expected} tools`,
      matched.length === expected,
      `got ${matched.length}`,
    );
  }

  // 6. PDF security tools appear in top-level security filter
  for (const toolId of ["protect-pdf", "unlock-pdf", "redact-pdf", "metadata-cleaner"]) {
    assert(
      `6 ${toolId} in security filter`,
      toolMatchesCategoryFilter(toolId, "security"),
    );
    assert(
      `6 ${toolId} primary category is pdf`,
      getToolCategoryMeta(toolId)?.primaryCategory === "pdf",
    );
  }

  // 7. Non-PDF security only in security (not pdf)
  assert(
    "7 security-scan not in pdf filter",
    !toolMatchesCategoryFilter("security-scan", "pdf"),
  );
  assert(
    "7 security-scan in security filter",
    toolMatchesCategoryFilter("security-scan", "security"),
  );

  // 8. watermark-pdf is edit pdf (not standalone security)
  assert(
    "8 watermark-pdf pdfSubcategory is edit",
    getToolCategoryMeta("watermark-pdf")?.pdfSubcategory === "edit",
  );

  // 9. Category URL contract
  const urlFilters: ToolCategoryFilterId[] = [
    "all",
    "pdf",
    "organize-pdf",
    "convert-pdf",
    "edit-pdf",
    "optimize-pdf",
    "security-pdf",
    "security",
    "image",
    "ai",
  ];

  for (const filterId of urlFilters) {
    const href = getToolsCategoryHref(filterId);
    const parsed =
      filterId === "all"
        ? parseToolsCategoryParam(null)
        : parseToolsCategoryParam(new URL(href, "https://scanonix.com").searchParams.get("category"));
    assert(`9 ${filterId} href round-trips`, parsed === filterId);
  }

  // 10. No duplicate matrix entries
  assert(
    "10 no duplicate matrix tool ids",
    new Set(CANONICAL_TOOL_IDS).size === CANONICAL_TOOL_IDS.length,
  );

  // 11. PDF subfilters defined
  assert(
    "11 PDF subcategory filters defined",
    PDF_SUBCATEGORY_FILTERS.length === 6,
  );
  assert(
    "11 top-level filters defined",
    TOP_LEVEL_CATEGORY_FILTERS.length === 5,
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
