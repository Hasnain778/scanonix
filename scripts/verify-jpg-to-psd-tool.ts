/**
 * JPG to PSD public tool / access / discovery verifier.
 * Run: npm run verify:jpg-to-psd-tool
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
  console.log("\nJPG to PSD public tool verifier\n");

  const pagePath = join(root, "app", "tools", "jpg-to-psd", "page.tsx");
  const apiPath = join(root, "app", "api", "tools", "jpg-to-psd", "route.ts");
  const uiPath = join(root, "components", "tools", "jpg-to-psd", "JpgToPsdTool.tsx");
  const lazyPath = join(root, "components", "tools", "lazy.tsx");
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
  const rasterUiPath = join(
    root,
    "components",
    "tools",
    "raster-to-vector",
    "RasterToVectorTool.tsx",
  );

  const pageSource = readFileSync(pagePath, "utf8");
  const apiSource = readFileSync(apiPath, "utf8");
  const uiSource = readFileSync(uiPath, "utf8");
  const lazySource = readFileSync(lazyPath, "utf8");
  const access = getToolAccess("jpg-to-psd");
  const seo = TOOL_SEO["jpg-to-psd"];
  const homepage = HOMEPAGE_TOOLS.filter((t) => t.id === "jpg-to-psd");
  const directory = SCANONIX_TOOLS.filter((t) => t.id === "jpg-to-psd");
  const category = getToolCategoryMeta("jpg-to-psd");
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
  const faqBlob = faqs.map((f) => `${f.question} ${f.answer}`).join(" ");

  assert("1 route exists", existsSync(pagePath));
  assert(
    "2 page uses modern tool shell",
    pageSource.includes("ToolRoute") &&
      pageSource.includes("LazyJpgToPsdTool") &&
      uiSource.includes("ToolWorkspaceShell"),
  );
  assert(
    "3 lazy component wired",
    lazySource.includes("LazyJpgToPsdTool") &&
      lazySource.includes("jpg-to-psd/JpgToPsdTool"),
  );
  assert(
    "4 correct slug",
    pageSource.includes('toolId="jpg-to-psd"') &&
      homepage[0]?.id === "jpg-to-psd" &&
      seo?.id === "jpg-to-psd",
  );
  assert(
    "5 category image",
    category?.primaryCategory === "image",
    category?.primaryCategory ?? "missing",
  );
  assert(
    "6 displayOrder 241",
    category?.displayOrder === 241,
    String(category?.displayOrder),
  );
  assert(
    "7 FREE_SERVER",
    Boolean(
      access &&
        access.processing === "server" &&
        access.requiresAuth === false &&
        access.requiresPro === false &&
        !access.requiresPremiumAi,
    ),
  );
  assert(
    "8 no auth/pro requirement",
    Boolean(access && access.requiresAuth === false && access.requiresPro === false),
  );
  assert(
    "9 upload accepts JPG/JPEG",
    uiSource.includes(".jpg") &&
      uiSource.includes(".jpeg") &&
      uiSource.includes("image/jpeg") &&
      !uiSource.includes(".png") &&
      !uiSource.includes("image/png") &&
      !uiSource.includes("image/webp"),
  );
  assert(
    "10 primary CTA Convert to PSD",
    uiSource.includes("Convert to PSD") &&
      !uiSource.includes("Vectorize") &&
      !uiSource.includes("Convert to SVG") &&
      !uiSource.includes("Export design layers"),
  );
  assert(
    "11 API endpoint correct",
    uiSource.includes('"/api/tools/jpg-to-psd"') &&
      apiSource.includes('toolId: "jpg-to-psd"') &&
      apiSource.includes("handleImageToolRequest"),
  );
  assert(
    "12 file-only request",
    formAppends.length === 1 &&
      formAppends[0] === "file" &&
      apiSource.includes('ALLOWED_FORM_FIELDS = new Set(["file"])'),
  );
  assert(
    "13 truthful single-layer copy",
    uiSource.includes("single raster layer") &&
      (/single raster layer|one raster image layer|single-layer/i.test(
        seo?.metaDescription ?? "",
      ) &&
        /single raster|one raster image layer|single-layer/i.test(
          seo?.headerDescription ?? "",
        )),
  );
  assert(
    "14 no fully editable PSD claim",
    !/Fully editable PSD/i.test(uiSource) &&
      !/fully editable PSD/i.test(seo?.metaDescription ?? "") &&
      Boolean(seo?.pageDescription?.includes("does not produce a fully editable")),
  );
  assert(
    "15 no layer reconstruction claim",
    !/recover original layers/i.test(uiSource) &&
      !/AI layer separation/i.test(uiSource) &&
      !/Editable text layers/i.test(uiSource) &&
      !/smart-object reconstruction/i.test(uiSource) &&
      !/Lossless design recovery/i.test(uiSource) &&
      uiSource.includes("cannot be reconstructed"),
  );
  assert(
    "16 result metadata includes RGB 8-bit",
    uiSource.includes("RGB 8-bit") && uiSource.includes("Color mode"),
  );
  assert(
    "17 result metadata includes 1 raster layer",
    uiSource.includes("1 raster layer") && uiSource.includes("Layers"),
  );
  assert("18 Download PSD CTA", uiSource.includes("Download PSD"));
  assert("19 Convert another", uiSource.includes("Convert another"));
  assert(
    "20 convert success = PSD ready!",
    convertSuccessSlice.includes('setMessage("PSD ready!")') &&
      uiSource.includes("✓ PSD ready"),
  );
  assert(
    "21 download success only after click",
    downloadHandlerSlice.includes('setMessage("PSD downloaded successfully!")') &&
      !convertSuccessSlice.includes("PSD downloaded successfully"),
  );
  assert(
    "22 blob/object URL handling",
    uiSource.includes("createObjectURL") &&
      uiSource.includes("revokeObjectURL") &&
      uiSource.includes("downloadBlob"),
  );
  assert(
    "23 mobile FAB clearance present",
    uiSource.includes("pr-32") &&
      uiSource.includes("sm:pr-40") &&
      /pr-32 sm:pr-40 lg:pr-0/.test(uiSource) &&
      /pl-3\.5 pr-40|pl-3\.5 pr-32|sm:pl-4 sm:pr-4[04]|pl-3 pr-32/.test(uiSource) &&
      /max-md:mb-3[246]|max-md:mb-40/.test(uiSource) &&
      /pb-40 md:pb-0/.test(uiSource) &&
      !/px-\d+[^\n]*pr-3[24]/.test(uiSource),
  );
  assert(
    "24 canonical correct",
    seo?.path === "/tools/jpg-to-psd" &&
      INDEXABLE_TOOL_PATHS.includes("/tools/jpg-to-psd") &&
      homepage[0]?.href === "/tools/jpg-to-psd",
  );
  assert(
    "25 SEO title/meta truthful",
    /JPG to PSD Converter Online/i.test(seo?.seoTitle ?? "") &&
      /JPG\/JPEG to PSD|JPG to PSD|JPEG/i.test(seo?.metaDescription ?? "") &&
      /single.?layer|single raster/i.test(seo?.metaDescription ?? "") &&
      /Photoshop-compatible/i.test(seo?.metaDescription ?? ""),
  );
  assert(
    "26 FAQ limitation copy",
    faqs.length >= 5 &&
      /recreate Photoshop layers/i.test(faqBlob) &&
      /flattened/i.test(faqBlob) &&
      /One raster image layer/i.test(faqBlob) &&
      /JPG and JPEG/i.test(faqBlob) &&
      /8-bit/i.test(faqBlob) &&
      /Photoshop-compatible PSD workflows/i.test(faqBlob),
  );
  assert(
    "27 catalog discovery",
    homepage.length === 1 &&
      directory.length === 1 &&
      homepage[0]?.available === true &&
      SCANONIX_TOOLS.length === 41,
  );
  assert(
    "28 image nav/hub discovery",
    (IMAGE_TOOL_IDS as readonly string[]).includes("jpg-to-psd") &&
      IMAGE_HUB_EDIT_TOOLS.some((t) => t.id === "jpg-to-psd") &&
      HOMEPAGE_TOOLS.filter((t) => t.category === "image").length === 16,
  );
  assert(
    "29 not in POPULAR_TOOL_IDS",
    !(POPULAR_TOOL_IDS as readonly string[]).includes("jpg-to-psd"),
  );
  assert(
    "30 related live tools sane",
    (seo?.relatedToolIds ?? []).includes("jpg-to-png") &&
      (seo?.relatedToolIds ?? []).includes("png-to-jpg") &&
      (seo?.relatedToolIds ?? []).includes("png-to-psd") &&
      (TOOL_SEO["jpg-to-png"]?.relatedToolIds ?? []).includes("jpg-to-psd") &&
      (TOOL_SEO["png-to-jpg"]?.relatedToolIds ?? []).includes("jpg-to-psd"),
  );
  assert(
    "31 PNG-to-PSD public surface present",
    existsSync(join(root, "app", "tools", "png-to-psd", "page.tsx")) &&
      "png-to-psd" in TOOL_SEO &&
      HOMEPAGE_TOOLS.some((t) => t.id === "png-to-psd"),
  );
  assert(
    "32 Background Remover absent",
    !existsSync(join(root, "app", "tools", "background-remover", "page.tsx")) &&
      !HOMEPAGE_TOOLS.some(
        (t) => t.id === "background-remover" || t.id === "bg-remove",
      ),
  );
  assert(
    "33 frozen Logo/Image/Raster components present",
    existsSync(logoUiPath) &&
      existsSync(imageToSvgUiPath) &&
      existsSync(rasterUiPath),
  );
  assert(
    "34 no dangerous HTML rendering",
    !uiSource.includes("dangerouslySetInnerHTML"),
  );
  assert(
    "35 no fake PSD client generation",
    !uiSource.includes("ag-psd") &&
      !uiSource.includes("createPsdFromRaster") &&
      !uiSource.includes("writePsd") &&
      uiSource.includes("submitImageToolForm"),
  );
  assert(
    "36 no canvas dependency in UI",
    !uiSource.includes('from "canvas"') &&
      !uiSource.includes("node-canvas") &&
      !uiSource.includes("@napi-rs/canvas") &&
      !/\bHTMLCanvasElement\b/.test(uiSource) &&
      !/\.getContext\(\s*["']2d["']/.test(uiSource),
  );
  assert(
    "37 accessibility basics for file/input/actions",
    uiSource.includes("FileDropZone") &&
      uiSource.includes("aria-label") &&
      uiSource.includes("ActionButton") &&
      uiSource.includes("ToolStickyMobileActionBar"),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
