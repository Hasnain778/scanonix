/**
 * Raster to Vector public tool / access / discovery verifier.
 * Run: npm run verify:raster-to-vector-tool
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HOMEPAGE_TOOLS, POPULAR_TOOL_IDS } from "../constants/homepage-tools";
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
  console.log("\nRaster to Vector public tool verifier\n");

  const pagePath = join(root, "app", "tools", "raster-to-vector", "page.tsx");
  const apiPath = join(root, "app", "api", "tools", "raster-to-vector", "route.ts");
  const uiPath = join(
    root,
    "components",
    "tools",
    "raster-to-vector",
    "RasterToVectorTool.tsx",
  );
  const optionsPath = join(
    root,
    "lib",
    "design",
    "vectorize",
    "raster-to-vector-options.ts",
  );
  const logoUiPath = join(
    root,
    "components",
    "tools",
    "logo-vectorizer",
    "LogoVectorizerTool.tsx",
  );
  const imageToSvgUiPath = join(
    root,
    "components",
    "tools",
    "image-to-svg",
    "ImageToSvgTool.tsx",
  );
  const lazyPath = join(root, "components", "tools", "lazy.tsx");

  const apiSource = readFileSync(apiPath, "utf8");
  const uiSource = readFileSync(uiPath, "utf8");
  const optionsSource = readFileSync(optionsPath, "utf8");
  const lazySource = readFileSync(lazyPath, "utf8");
  const access = getToolAccess("raster-to-vector");
  const seo = TOOL_SEO["raster-to-vector"];
  const homepage = HOMEPAGE_TOOLS.filter((t) => t.id === "raster-to-vector");
  const directory = SCANONIX_TOOLS.filter((t) => t.id === "raster-to-vector");
  const category = getToolCategoryMeta("raster-to-vector");

  assert("1 public route exists", existsSync(pagePath));
  assert("2 API route exists", existsSync(apiPath));
  assert(
    "3 TOOL_ACCESS exists",
    Boolean(access),
    access ? "" : "missing raster-to-vector",
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
    "6 displayOrder 238",
    category?.displayOrder === 238,
    String(category?.displayOrder),
  );
  assert(
    "7 lazy registration",
    lazySource.includes("LazyRasterToVectorTool") &&
      lazySource.includes("raster-to-vector/RasterToVectorTool"),
  );
  assert(
    "8 four controls + defaults",
    uiSource.includes("Colors") &&
      uiSource.includes("Detail") &&
      uiSource.includes("Smoothing") &&
      uiSource.includes("Ignore background") &&
      optionsSource.includes("colorCount: 24") &&
      optionsSource.includes('detail: "High"') &&
      optionsSource.includes('smoothing: "Balanced"') &&
      optionsSource.includes("ignoreBackground: false") &&
      uiSource.includes("RASTER_DEFAULTS"),
  );
  assert(
    "9 Convert to Vector CTA (not Convert to SVG primary)",
    uiSource.includes("Convert to Vector") &&
      !uiSource.includes('"Convert to SVG"') &&
      !uiSource.includes("'Convert to SVG'"),
  );
  assert(
    "10 Download SVG + Vector ready semantics",
    uiSource.includes("Download SVG") &&
      uiSource.includes("Vector ready!") &&
      uiSource.includes("✓ Vector ready") &&
      uiSource.includes("SVG downloaded successfully!") &&
      uiSource.includes("createObjectURL") &&
      !uiSource.includes("dangerouslySetInnerHTML"),
  );
  const downloadHandlerSlice = uiSource.slice(
    uiSource.indexOf("const handleDownload"),
    uiSource.indexOf("const resetTool"),
  );
  const convertSuccessSlice = uiSource.slice(
    uiSource.indexOf('attempt.success(1)'),
    uiSource.indexOf("const handleDownload"),
  );
  assert(
    "11 download-success only after download click pattern",
    downloadHandlerSlice.includes('setMessage("SVG downloaded successfully!")') &&
      convertSuccessSlice.includes('setMessage("Vector ready!")') &&
      !convertSuccessSlice.includes("SVG downloaded successfully"),
  );
  assert(
    "12 advanced settings / mobile FAB clearance",
    uiSource.includes("Advanced settings") &&
      uiSource.includes("pr-32") &&
      uiSource.includes("sm:pr-40") &&
      /pr-32 sm:pr-40 lg:pr-0/.test(uiSource) &&
      /pl-3\.5 pr-32|sm:pl-4 sm:pr-40|pl-3 pr-32/.test(uiSource) &&
      !/px-\d+[^\n]*pr-32/.test(uiSource),
  );
  assert(
    "13 truthful Raster wording; not Logo-only CTA",
    /raster|vector|tracing/i.test(seo?.metaDescription ?? "") &&
      !uiSource.includes("Vectorize Logo") &&
      !uiSource.includes("Best for logos") &&
      !/AI reconstruction/i.test(seo?.metaDescription ?? "") &&
      /control/i.test(seo?.metaDescription ?? ""),
  );
  assert(
    "14 not reduced to Image to SVG one-click",
    apiSource.includes('preset: "advanced"') &&
      uiSource.includes("colorCount") &&
      uiSource.includes("ignoreBackground") &&
      optionsSource.includes("ALLOWED_FIELDS") &&
      !apiSource.includes('preset: "general"') &&
      !apiSource.includes('preset: "logo"'),
  );
  assert(
    "15 discovery + related SEO",
    homepage.length === 1 &&
      directory.length === 1 &&
      homepage[0]?.available === true &&
      homepage[0]?.href === "/tools/raster-to-vector" &&
      seo?.path === "/tools/raster-to-vector" &&
      INDEXABLE_TOOL_PATHS.includes("/tools/raster-to-vector") &&
      (seo.relatedToolIds ?? []).includes("image-to-svg") &&
      (seo.relatedToolIds ?? []).includes("logo-vectorizer") &&
      (TOOL_SEO["image-to-svg"]?.relatedToolIds ?? []).includes("raster-to-vector") &&
      (TOOL_SEO["logo-vectorizer"]?.relatedToolIds ?? []).includes("raster-to-vector"),
  );
  assert(
    "16 not forced into POPULAR_TOOL_IDS",
    !(POPULAR_TOOL_IDS as readonly string[]).includes("raster-to-vector"),
  );
  assert(
    "17 PNG-to-PSD + Background Remover absent; JPG-to-PSD public",
    existsSync(join(root, "app", "tools", "jpg-to-psd", "page.tsx")) &&
      !existsSync(join(root, "app", "tools", "png-to-psd", "page.tsx")) &&
      !existsSync(join(root, "app", "tools", "background-remover", "page.tsx")) &&
      !HOMEPAGE_TOOLS.some(
        (t) => t.id === "background-remover" || t.id === "bg-remove",
      ),
  );
  assert(
    "18 frozen Logo / Image to SVG component paths present",
    existsSync(logoUiPath) &&
      existsSync(imageToSvgUiPath) &&
      existsSync(join(root, "app", "tools", "logo-vectorizer", "page.tsx")) &&
      existsSync(join(root, "app", "tools", "image-to-svg", "page.tsx")),
  );
  assert(
    "19 Convert another reset present",
    uiSource.includes("Convert another") && uiSource.includes("resetControlsToDefaults"),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
