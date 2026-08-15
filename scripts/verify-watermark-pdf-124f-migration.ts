/**
 * Canonical route migration tests for Watermark PDF (Phase 124F).
 * Run: npx tsx scripts/verify-watermark-pdf-124f-migration.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HOMEPAGE_CATEGORY_GRIDS, HOMEPAGE_TOOLS } from "../constants/homepage-tools";
import { INDEXABLE_TOOL_PATHS, TOOL_SEO } from "../constants/tool-seo";
import { getToolAccess, TOOL_ACCESS } from "../lib/plan/tool-access";
import {
  MAX_WATERMARK_PDF_BYTES,
  WATERMARK_PDF_PRIVACY_COPY,
} from "../lib/tools/watermark-pdf";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function exists(relativePath: string): boolean {
  return existsSync(join(root, relativePath));
}

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
  console.log("\nWatermark PDF 124F migration verification\n");

  const canonicalPage = read("app/tools/watermark-pdf/page.tsx");
  const clientPage = read("app/tools/watermark-pdf-client/page.tsx");
  const clientTool = read("components/tools/watermark-pdf-client/WatermarkPdfClientTool.tsx");
  const lazySource = read("components/tools/lazy.tsx");
  const toolAccessSource = read("lib/plan/tool-access.ts");
  const homepageSource = read("constants/homepage-tools.ts");
  const seoSource = read("constants/tool-seo.ts");
  const sitemapSource = read("app/sitemap.ts");
  const toolFinderSource = read("lib/tools/tool-finder.ts");

  // A. /tools/watermark-pdf uses client workspace
  assert(
    "A canonical route uses client workspace",
    canonicalPage.includes("LazyWatermarkPdfClientTool") ||
      canonicalPage.includes("WatermarkPdfClientTool"),
  );

  // B. canonical route does not use LazyWatermarkPdfTool
  assert(
    "B canonical route does not use LazyWatermarkPdfTool",
    !canonicalPage.includes("LazyWatermarkPdfTool"),
  );

  // C. canonical route does not invoke old server API
  assert(
    "C client tool has no server API calls",
    !clientTool.includes("/api/tools/security/watermark-pdf") &&
      !clientTool.includes("submitSecurityToolForm") &&
      !clientTool.includes("gateToolOperation"),
  );
  assert(
    "C canonical page has no server API references",
    !canonicalPage.includes("/api/tools/security/watermark-pdf"),
  );

  // D. Watermark is FREE in canonical access metadata
  const access = getToolAccess("watermark-pdf");
  assert("D watermark-pdf requiresPro is false", access?.requiresPro === false);
  assert("D watermark-pdf requiresAuth is false", access?.requiresAuth === false);
  assert("D watermark-pdf processing is client", access?.processing === "client");
  assert(
    "D tool-access.ts uses FREE_CLIENT for watermark-pdf",
    toolAccessSource.includes('"watermark-pdf": { ...FREE_CLIENT, route: "watermark-pdf" }'),
  );

  // E. Watermark no longer receives Pro execution gate
  assert(
    "E client tool has no Pro gate or upgrade modal",
    !clientTool.includes("SecurityToolGate") &&
      !clientTool.includes("UpgradeModal") &&
      !clientTool.includes("requiresPro"),
  );

  // F. other Pro tools remain unchanged
  assert("F protect-pdf still requires Pro", getToolAccess("protect-pdf")?.requiresPro === true);
  assert("F unlock-pdf still requires Pro", getToolAccess("unlock-pdf")?.requiresPro === true);
  assert("F redact-pdf still requires Pro", getToolAccess("redact-pdf")?.requiresPro === true);
  assert(
    "F metadata-cleaner still requires Pro",
    getToolAccess("metadata-cleaner")?.requiresPro === true,
  );
  assert(
    "F protect-pdf still server-side",
    getToolAccess("protect-pdf")?.processing === "server",
  );

  // G. canonical URL remains /tools/watermark-pdf
  assert(
    "G canonical SEO path is /tools/watermark-pdf",
    TOOL_SEO["watermark-pdf"].path === "/tools/watermark-pdf",
  );
  const homepageTool = HOMEPAGE_TOOLS.find((tool) => tool.id === "watermark-pdf");
  assert(
    "G homepage tool href is /tools/watermark-pdf",
    homepageTool?.href === "/tools/watermark-pdf",
  );

  // H. canonical route is indexable
  assert(
    "H canonical path is in INDEXABLE_TOOL_PATHS",
    INDEXABLE_TOOL_PATHS.includes("/tools/watermark-pdf"),
  );
  assert(
    "H canonical page uses createToolPageMetadata",
    canonicalPage.includes('createToolPageMetadata("watermark-pdf")'),
  );
  assert(
    "H client test route is not in INDEXABLE_TOOL_PATHS",
    !INDEXABLE_TOOL_PATHS.includes("/tools/watermark-pdf-client"),
  );

  // I. temporary client route remains noindex
  assert(
    "I client test route robots noindex",
    clientPage.includes("index: false") && clientPage.includes("follow: false"),
  );

  // J. temporary route absent from sitemap/discovery
  assert(
    "J sitemap uses INDEXABLE_TOOL_PATHS only",
    sitemapSource.includes("INDEXABLE_TOOL_PATHS"),
  );
  assert(
    "J client test route not listed in TOOL_SEO",
    !Object.prototype.hasOwnProperty.call(TOOL_SEO, "watermark-pdf-client"),
  );
  assert(
    "J client test route not in HOMEPAGE_TOOLS",
    !HOMEPAGE_TOOLS.some((tool) => tool.id === "watermark-pdf-client"),
  );

  // K. discovery points to canonical route only
  const securityGrid = HOMEPAGE_CATEGORY_GRIDS.security.find(
    (item) => item.id === "watermark-pdf",
  );
  assert(
    "K security grid points to canonical route",
    securityGrid?.href === "/tools/watermark-pdf",
  );
  assert(
    "K tool finder maps watermark-pdf id",
    toolFinderSource.includes('"watermark-pdf":'),
  );
  assert(
    "K tool finder does not expose client test route",
    !toolFinderSource.includes("watermark-pdf-client"),
  );

  // L. no duplicate Watermark entries
  const watermarkHomepageEntries = HOMEPAGE_TOOLS.filter((tool) =>
    tool.name.toLowerCase().includes("watermark"),
  );
  assert(
    "L single Watermark entry in HOMEPAGE_TOOLS",
    watermarkHomepageEntries.length === 1 &&
      watermarkHomepageEntries[0]?.id === "watermark-pdf",
  );
  const watermarkGridEntries = HOMEPAGE_CATEGORY_GRIDS.security.filter((item) =>
    item.name.toLowerCase().includes("watermark"),
  );
  assert(
    "L single Watermark entry in security grid",
    watermarkGridEntries.length === 1 &&
      watermarkGridEntries[0]?.id === "watermark-pdf",
  );

  // M. local-processing copy accurate
  assert(
    "M privacy copy matches canonical client message",
    clientTool.includes("WATERMARK_UI_PRIVACY_COPY") &&
      WATERMARK_PDF_PRIVACY_COPY ===
        "Your PDF is watermarked locally in your browser and is not uploaded to Scanonix servers.",
  );
  assert(
    "M SEO mentions local browser processing",
    seoSource.includes("processed locally in your browser") ||
      seoSource.includes("local browser processing"),
  );
  assert(
    "M SEO does not claim Pro-only watermark",
    !seoSource.match(/watermark-pdf[\s\S]{0,400}Pro-only/i),
  );

  // N. 10 MB limit accurately represented
  const maxMb = Math.round(MAX_WATERMARK_PDF_BYTES / (1024 * 1024));
  assert("N MAX_WATERMARK_PDF_BYTES is 10 MB", maxMb === 10);
  assert(
    "N UI communicates 10 MB limit",
    clientTool.includes("10 MB") || clientTool.includes(`${maxMb}MB`),
  );
  assert(
    "N SEO documents 10 MB limit",
    seoSource.includes("10 MB"),
  );

  // O. encrypted PDF handling accurate
  assert(
    "O load-document maps password PDFs to PASSWORD_PDF",
    read("lib/tools/watermark-pdf/load-document.ts").includes("PASSWORD_PDF"),
  );
  assert(
    "O SEO documents password-protected PDF limitation",
    seoSource.includes("Password-protected PDFs"),
  );

  // P. text/image mode preserved
  assert(
    "P mode selector preserved",
    clientTool.includes("data-watermark-mode-selector"),
  );
  assert(
    "P dedicated image upload input preserved",
    clientTool.includes('id="watermark-image-input"'),
  );
  assert(
    "P SEO documents text-or-image limitation",
    seoSource.includes("one text watermark or one image watermark"),
  );

  // Q. old server API files still exist for rollback
  assert(
    "Q old server component exists",
    exists("components/tools/security/WatermarkPdfTool.tsx"),
  );
  assert(
    "Q old API route exists",
    exists("app/api/tools/security/watermark-pdf/route.ts"),
  );
  assert(
    "Q old provider integration exists",
    exists("lib/security-tools/pdf/watermark.ts"),
  );
  assert(
    "Q lazy rollback export retained",
    lazySource.includes("LazyWatermarkPdfTool"),
  );

  console.log(`\n124F migration: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
