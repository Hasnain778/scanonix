/**
 * PNG to PSD public tool / access / discovery verifier.
 * Run: npm run verify:png-to-psd-tool
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HOMEPAGE_TOOLS, POPULAR_TOOL_IDS } from "../constants/homepage-tools";
import { IMAGE_TOOL_IDS } from "../constants/image-tool-relationships";
import { IMAGE_HUB_EDIT_TOOLS } from "../constants/image-tools";
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
  console.log("\nPNG to PSD public tool verifier\n");

  const pagePath = join(root, "app", "tools", "png-to-psd", "page.tsx");
  const apiPath = join(root, "app", "api", "tools", "png-to-psd", "route.ts");
  const uiPath = join(root, "components", "tools", "png-to-psd", "PngToPsdTool.tsx");
  const lazyPath = join(root, "components", "tools", "lazy.tsx");
  const clientPath = join(root, "lib", "tools", "image", "client.ts");

  const pageSource = readFileSync(pagePath, "utf8");
  const apiSource = readFileSync(apiPath, "utf8");
  const uiSource = readFileSync(uiPath, "utf8");
  const lazySource = readFileSync(lazyPath, "utf8");
  const clientSource = readFileSync(clientPath, "utf8");
  const access = getToolAccess("png-to-psd");
  const seo = TOOL_SEO["png-to-psd"];
  const homepage = HOMEPAGE_TOOLS.filter((t) => t.id === "png-to-psd");
  const directory = SCANONIX_TOOLS.filter((t) => t.id === "png-to-psd");
  const category = getToolCategoryMeta("png-to-psd");
  const formAppends = [...uiSource.matchAll(/formData\.append\("([^"]+)"/g)].map(
    (m) => m[1],
  );
  const convertSuccessSlice = uiSource.slice(
    uiSource.indexOf("attempt.success(1)"),
    uiSource.indexOf("const handleDownload"),
  );
  const downloadHandlerSlice = uiSource.slice(
    uiSource.indexOf("const handleDownload"),
    uiSource.indexOf("const resetTool"),
  );
  const faqs = seo?.faqs ?? [];

  assert("1 route exists", existsSync(pagePath) && existsSync(apiPath));
  assert(
    "2 page uses modern tool shell",
    pageSource.includes("ToolRoute") && pageSource.includes("LazyPngToPsdTool"),
  );
  assert(
    "3 lazy component wired",
    lazySource.includes("LazyPngToPsdTool") &&
      lazySource.includes("png-to-psd/PngToPsdTool"),
  );
  assert(
    "4 correct slug",
    pageSource.includes('toolId="png-to-psd"') &&
      homepage[0]?.href === "/tools/png-to-psd" &&
      seo?.path === "/tools/png-to-psd",
  );
  assert(
    "5 category image",
    category?.primaryCategory === "image" && homepage[0]?.category === "image",
  );
  assert("6 displayOrder 242", category?.displayOrder === 242);
  assert(
    "7 FREE_SERVER",
    access?.processing === "server" &&
      access.requiresAuth === false &&
      access.requiresPro === false,
  );
  assert(
    "8 no auth/pro requirement",
    access?.requiresAuth === false && access?.requiresPro === false,
  );
  assert(
    "9 upload accepts PNG",
    uiSource.includes(".png") &&
      uiSource.includes("image/png") &&
      !uiSource.includes("image/jpeg"),
  );
  assert(
    "10 primary CTA Convert to PSD",
    uiSource.includes("Convert to PSD") && uiSource.includes("Download PSD"),
  );
  assert(
    "11 API endpoint correct",
    uiSource.includes('"/api/tools/png-to-psd"') &&
      apiSource.includes('toolId: "png-to-psd"'),
  );
  assert(
    "12 file-only request",
    formAppends.length === 1 && formAppends[0] === "file",
  );
  assert(
    "13 truthful single-layer + transparency copy",
    uiSource.includes("single raster layer") &&
      uiSource.includes("PNG transparency is preserved when present"),
  );
  assert(
    "14 no fully editable PSD claim",
    !/fully editable/i.test(uiSource) && !/fully editable/i.test(seo?.metaDescription ?? ""),
  );
  assert(
    "15 no layer reconstruction claim",
    /cannot be\s+reconstructed/i.test(uiSource) &&
      !/recover(ed|ing|s)?\s+(original\s+)?(layers|text)/i.test(uiSource),
  );
  assert(
    "16 result metadata includes RGB 8-bit",
    uiSource.includes("RGB 8-bit"),
  );
  assert(
    "17 result metadata includes 1 raster layer",
    uiSource.includes("1 raster layer"),
  );
  assert(
    "18 transparency header usage",
    clientSource.includes("X-Image-Has-Alpha") &&
      uiSource.includes("transparencyLabel") &&
      uiSource.includes("Preserved") &&
      uiSource.includes("None") &&
      uiSource.includes("Unknown") &&
      uiSource.includes("stats.hasAlpha"),
  );
  assert(
    "19 Download PSD CTA",
    uiSource.includes("Download PSD"),
  );
  assert(
    "20 Convert another",
    uiSource.includes("Convert another") && uiSource.includes("resetTool"),
  );
  assert(
    "21 convert success = PSD ready!",
    convertSuccessSlice.includes('setMessage("PSD ready!")') &&
      !convertSuccessSlice.includes("downloaded successfully"),
  );
  assert(
    "22 download success only after click",
    downloadHandlerSlice.includes('setMessage("PSD downloaded successfully!")'),
  );
  assert(
    "23 blob/object URL handling",
    uiSource.includes("URL.createObjectURL") &&
      uiSource.includes("URL.revokeObjectURL") &&
      uiSource.includes("previewUrlRef"),
  );
  assert(
    "24 mobile FAB clearance present",
    uiSource.includes("pr-32") &&
      uiSource.includes("sm:pr-40") &&
      uiSource.includes("pr-40") &&
      uiSource.includes("max-md:mb-36") &&
      uiSource.includes("pb-40"),
  );
  assert(
    "25 canonical correct",
    seo?.path === "/tools/png-to-psd" &&
      INDEXABLE_TOOL_PATHS.includes("/tools/png-to-psd") &&
      homepage[0]?.href === "/tools/png-to-psd",
  );
  assert(
    "26 SEO title/meta truthful",
    /PNG to PSD Converter Online/i.test(seo?.seoTitle ?? "") &&
      /single[- ]layer/i.test(seo?.metaDescription ?? "") &&
      /transparency/i.test(seo?.metaDescription ?? ""),
  );
  assert(
    "27 FAQ consistency",
    faqs.length >= 4 &&
      faqs.some((f) => /transparency/i.test(f.question)) &&
      faqs.some((f) => /editable/i.test(f.question)) &&
      faqs.some((f) => /layer/i.test(f.question)) &&
      faqs.every((f) => f.question.trim() && f.answer.trim()),
  );
  assert(
    "28 catalog discovery",
    directory.length === 1 &&
      SCANONIX_TOOLS.length === 41 &&
      HOMEPAGE_TOOLS.filter((t) => t.category === "image" && t.available).length ===
        16,
  );
  assert(
    "29 image nav/hub discovery",
    (IMAGE_TOOL_IDS as readonly string[]).includes("png-to-psd") &&
      IMAGE_HUB_EDIT_TOOLS.some((t) => t.id === "png-to-psd") &&
      IMAGE_TOOL_IDS.length === 16,
  );
  assert(
    "30 not in POPULAR_TOOL_IDS",
    !(POPULAR_TOOL_IDS as readonly string[]).includes("png-to-psd"),
  );
  assert(
    "31 related live tools sane",
    (seo?.relatedToolIds ?? []).includes("jpg-to-psd") &&
      (seo?.relatedToolIds ?? []).includes("png-to-jpg") &&
      (seo?.relatedToolIds ?? []).includes("jpg-to-png") &&
      (TOOL_SEO["jpg-to-psd"]?.relatedToolIds ?? []).includes("png-to-psd"),
  );
  assert(
    "32 APNG not advertised as supported",
    /animated png is not supported/i.test(uiSource) &&
      !/supports animated png/i.test(uiSource),
  );
  assert(
    "33 ToolWorkspaceShell used",
    uiSource.includes("ToolWorkspaceShell"),
  );
  assert(
    "34 Background Remover absent",
    !existsSync(join(root, "app", "tools", "background-remover", "page.tsx")) &&
      !HOMEPAGE_TOOLS.some(
        (t) => t.id === "background-remover" || t.id === "bg-remove",
      ),
  );
  assert(
    "35 no dangerous HTML rendering",
    !uiSource.includes("dangerouslySetInnerHTML"),
  );
  assert(
    "36 no fake PSD client generation",
    !uiSource.includes("ag-psd") &&
      !uiSource.includes("createPsdFromRaster") &&
      !uiSource.includes("writePsdBuffer"),
  );
  assert(
    "37 no canvas dependency in UI",
    !uiSource.includes('from "canvas"') && !uiSource.includes("@napi-rs/canvas"),
  );
  assert(
    "38 accessibility basics for file/input/actions",
    uiSource.includes("FileDropZone") &&
      uiSource.includes('aria-label="PNG to PSD result"'),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
