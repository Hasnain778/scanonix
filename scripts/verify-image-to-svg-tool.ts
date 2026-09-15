/**
 * Image to SVG public tool / access / discovery verifier.
 * Run: npm run verify:image-to-svg-tool
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
  console.log("\nImage to SVG public tool verifier\n");

  const pagePath = join(root, "app", "tools", "image-to-svg", "page.tsx");
  const apiPath = join(root, "app", "api", "tools", "image-to-svg", "route.ts");
  const uiPath = join(root, "components", "tools", "image-to-svg", "ImageToSvgTool.tsx");
  const logoUiPath = join(
    root,
    "components",
    "tools",
    "logo-vectorizer",
    "LogoVectorizerTool.tsx",
  );
  const apiSource = readFileSync(apiPath, "utf8");
  const uiSource = readFileSync(uiPath, "utf8");
  const access = getToolAccess("image-to-svg");
  const seo = TOOL_SEO["image-to-svg"];
  const homepage = HOMEPAGE_TOOLS.filter((t) => t.id === "image-to-svg");
  const directory = SCANONIX_TOOLS.filter((t) => t.id === "image-to-svg");
  const category = getToolCategoryMeta("image-to-svg");

  assert("1 public route exists", existsSync(pagePath));
  assert("2 API route exists", existsSync(apiPath));
  assert(
    "3 TOOL_ACCESS exists",
    Boolean(access),
    access ? "" : "missing image-to-svg",
  );
  assert(
    "4 FREE_SERVER correct",
    Boolean(
      access &&
        access.processing === "server" &&
        access.requiresAuth === false &&
        access.requiresPro === false &&
        !access.requiresPremiumAi,
    ),
  );
  assert(
    "5 category image",
    category?.primaryCategory === "image",
    category?.primaryCategory ?? "missing",
  );
  assert(
    "6 displayOrder 237",
    category?.displayOrder === 237,
    String(category?.displayOrder),
  );
  assert(
    "7 UI posts to correct API",
    uiSource.includes('"/api/tools/image-to-svg"') ||
      uiSource.includes("'/api/tools/image-to-svg'"),
  );
  assert(
    "8 UI expects SVG",
    uiSource.includes("Download SVG") &&
      uiSource.includes("SVG ready!") &&
      uiSource.includes("SVG downloaded successfully!") &&
      uiSource.includes("createObjectURL"),
  );
  assert(
    "9 raster-only supported inputs",
    uiSource.includes(".png") &&
      uiSource.includes(".webp") &&
      !uiSource.includes("image/heic") &&
      !uiSource.includes("image/svg") &&
      apiSource.includes('preset: "general"') &&
      apiSource.includes("handleImageToolRequest") &&
      apiSource.includes('toolId: "image-to-svg"'),
  );
  assert(
    "10 Logo Vectorizer still exists unchanged path",
    existsSync(logoUiPath) &&
      existsSync(join(root, "app", "tools", "logo-vectorizer", "page.tsx")) &&
      HOMEPAGE_TOOLS.some((t) => t.id === "logo-vectorizer"),
  );
  assert(
    "11 Raster to Vector related (not a clone assertion)",
    existsSync(join(root, "app", "tools", "raster-to-vector", "page.tsx")) &&
      HOMEPAGE_TOOLS.some((t) => t.id === "raster-to-vector") &&
      !uiSource.includes("Convert to Vector") &&
      uiSource.includes("Convert to SVG"),
  );
  assert(
    "12 JPG-to-PSD and PNG-to-PSD public",
    existsSync(join(root, "app", "tools", "jpg-to-psd", "page.tsx")) &&
      existsSync(join(root, "app", "tools", "png-to-psd", "page.tsx")),
  );
  assert(
    "13 Background Remover absent",
    !HOMEPAGE_TOOLS.some((t) => t.id === "background-remover" || t.id === "bg-remove") &&
      !existsSync(join(root, "app", "tools", "background-remover", "page.tsx")),
  );
  assert(
    "14 discovery entry unique",
    homepage.length === 1 &&
      directory.length === 1 &&
      homepage[0]?.available === true &&
      homepage[0]?.href === "/tools/image-to-svg",
  );
  assert(
    "15 canonical SEO correct",
    seo?.path === "/tools/image-to-svg" &&
      INDEXABLE_TOOL_PATHS.includes("/tools/image-to-svg") &&
      /real SVG/i.test(seo.metaDescription) &&
      !/AI reconstruction/i.test(seo.metaDescription) &&
      !uiSource.includes("dangerouslySetInnerHTML") &&
      !uiSource.includes("Vectorize Logo") &&
      !uiSource.includes("Best for logos"),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
