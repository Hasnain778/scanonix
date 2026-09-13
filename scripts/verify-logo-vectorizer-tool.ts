/**
 * Logo Vectorizer public tool / access / discovery verifier.
 * Run: npm run verify:logo-vectorizer-tool
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HOMEPAGE_TOOLS } from "../constants/homepage-tools";
import { getToolCategoryMeta } from "../constants/tool-categories";
import { SCANONIX_TOOLS } from "../constants/tools-directory-data";
import { INDEXABLE_TOOL_PATHS, TOOL_SEO } from "../constants/tool-seo";
import { getToolAccess } from "../lib/plan/tool-access";

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

function run() {
  console.log("\nLogo Vectorizer public tool verifier\n");

  const pagePath = join(root, "app", "tools", "logo-vectorizer", "page.tsx");
  const apiPath = join(root, "app", "api", "tools", "logo-vectorizer", "route.ts");
  const uiPath = join(
    root,
    "components",
    "tools",
    "logo-vectorizer",
    "LogoVectorizerTool.tsx",
  );
  const apiSource = readFileSync(apiPath, "utf8");
  const uiSource = readFileSync(uiPath, "utf8");
  const access = getToolAccess("logo-vectorizer");
  const seo = TOOL_SEO["logo-vectorizer"];
  const homepage = HOMEPAGE_TOOLS.filter((t) => t.id === "logo-vectorizer");
  const directory = SCANONIX_TOOLS.filter((t) => t.id === "logo-vectorizer");
  const category = getToolCategoryMeta("logo-vectorizer");

  assert("1 route exists", existsSync(pagePath));
  assert("2 tool registry entry exists", homepage.length === 1 && homepage[0]?.available === true);
  assert(
    "3 TOOL_ACCESS entry exists",
    Boolean(access),
    access ? "" : "missing logo-vectorizer",
  );
  assert(
    "4 FREE_SERVER classification correct",
    Boolean(
      access &&
        access.processing === "server" &&
        access.requiresAuth === false &&
        access.requiresPro === false &&
        !access.requiresPremiumAi,
    ),
  );
  assert(
    "5 API uses normal access path",
    apiSource.includes("handleImageToolRequest") &&
      apiSource.includes('toolId: "logo-vectorizer"'),
  );
  assert(
    "6 no unmetered bypass remains",
    !apiSource.includes("Intentionally does NOT use handleImageToolRequest") &&
      apiSource.includes("handleImageToolRequest"),
  );
  assert(
    "7 UI calls correct API",
    uiSource.includes('"/api/tools/logo-vectorizer"') ||
      uiSource.includes("'/api/tools/logo-vectorizer'"),
  );
  assert(
    "8 download expects SVG",
    uiSource.includes("Download SVG") &&
      (uiSource.includes(".svg") || uiSource.includes("logo-vector.svg")),
  );
  assert(
    "9 raster-only supported inputs",
    uiSource.includes(".png") &&
      uiSource.includes(".webp") &&
      !uiSource.toLowerCase().includes("heic") &&
      apiSource.includes("isHeicMime"),
  );
  assert(
    "10 PSD tools remain absent; Raster to Vector is separate",
    existsSync(join(root, "app", "tools", "raster-to-vector", "page.tsx")) &&
      !existsSync(join(root, "app", "tools", "jpg-to-psd", "page.tsx")) &&
      !existsSync(join(root, "app", "tools", "png-to-psd", "page.tsx")) &&
      !uiSource.includes("Convert to Vector"),
  );
  assert(
    "11 Logo Vectorizer appears exactly once in directory/discovery",
    directory.length === 1 &&
      homepage.length === 1 &&
      INDEXABLE_TOOL_PATHS.filter((p) => p === "/tools/logo-vectorizer").length === 1 &&
      Boolean(seo) &&
      seo.path === "/tools/logo-vectorizer" &&
      category?.primaryCategory === "image",
  );
  assert(
    "12 no Background Remover reintroduced",
    !HOMEPAGE_TOOLS.some((t) => t.id === "background-remover" || t.id === "bg-remove") &&
      !existsSync(join(root, "app", "tools", "background-remover", "page.tsx")) &&
      !SCANONIX_TOOLS.some((t) => t.id.includes("background")),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
