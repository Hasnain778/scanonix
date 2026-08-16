/**
 * Canonical route migration tests for Redact PDF (Phase 125F).
 * Run: npx tsx scripts/verify-redact-pdf-125f-migration.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HOMEPAGE_CATEGORY_GRIDS, HOMEPAGE_TOOLS } from "../constants/homepage-tools";
import { INDEXABLE_TOOL_PATHS, TOOL_SEO } from "../constants/tool-seo";
import { getToolAccess, TOOL_ACCESS } from "../lib/plan/tool-access";
import {
  MAX_REDACT_PDF_BYTES,
  REDACT_PRIVACY_COPY,
  REDACT_RASTER_QUALITY_COPY,
  REDACT_SANITIZATION_LIMITATION_COPY,
} from "../lib/tools/redact-pdf";

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
  console.log("\nRedact PDF 125F migration verification\n");

  const canonicalPage = read("app/tools/redact-pdf/page.tsx");
  const clientPage = read("app/tools/redact-pdf-client/page.tsx");
  const clientTool = read("components/tools/redact-pdf-client/RedactPdfClientTool.tsx");
  const proClientTool = read("components/tools/redact-pdf-client/RedactPdfProClientTool.tsx");
  const lazySource = read("components/tools/lazy.tsx");
  const toolAccessSource = read("lib/plan/tool-access.ts");
  const homepageSource = read("constants/homepage-tools.ts");
  const seoSource = read("constants/tool-seo.ts");
  const sitemapSource = read("app/sitemap.ts");
  const toolFinderSource = read("lib/tools/tool-finder.ts");
  const clientExportSource = read("lib/tools/redact-pdf/client-export.ts");

  // A. canonical route uses client workspace
  assert(
    "A canonical route uses client workspace",
    canonicalPage.includes("LazyRedactPdfProClientTool") ||
      canonicalPage.includes("LazyRedactPdfClientTool") ||
      canonicalPage.includes("RedactPdfProClientTool"),
  );

  // B. canonical route does not use LazyRedactPdfTool
  assert(
    "B canonical route does not use LazyRedactPdfTool",
    !canonicalPage.includes("LazyRedactPdfTool"),
  );

  // C. canonical uses accepted secure client engine
  assert(
    "C client tool uses client-export engine",
    clientTool.includes("exportRedactedPdfFromWorkspace") &&
      clientExportSource.includes("rasterizeRedactedPage"),
  );
  assert(
    "C canonical page has no server API references",
    !canonicalPage.includes("/api/tools/security/redact-pdf"),
  );

  // D. Redact remains PRO
  const access = getToolAccess("redact-pdf");
  assert("D redact-pdf requiresPro is true", access?.requiresPro === true);
  assert("D redact-pdf requiresAuth is true", access?.requiresAuth === true);
  assert("D redact-pdf processing is client", access?.processing === "client");

  // E. Pro gate preserved
  assert(
    "E canonical uses SecurityToolWorkspace wrapper",
    proClientTool.includes("SecurityToolWorkspace") &&
      proClientTool.includes("proGateActive={showGate}"),
  );
  assert(
    "E client tool calls gateToolOperation on export",
    clientTool.includes('gateToolOperation(toolId') ||
      clientTool.includes('gateToolOperation("redact-pdf"'),
  );
  assert(
    "E Pro badge preserved in SecurityToolWorkspace",
    read("components/tools/security/SecurityToolWorkspace.tsx").includes("ProBadge"),
  );

  // F. authorized execution is CLIENT
  assert(
    "F tool-access decouples Pro from server processing",
    toolAccessSource.includes('"redact-pdf": {') &&
      Boolean(
        toolAccessSource.match(
          /"redact-pdf":\s*\{\s*\.\.\.PRO_SECURITY,\s*processing:\s*"client"/,
        ),
      ),
  );
  assert(
    "F client tool has no submitSecurityToolForm",
    !clientTool.includes("submitSecurityToolForm"),
  );

  // G. old API not called by canonical processing
  assert(
    "G client tool has no redact server API path",
    !clientTool.includes("/api/tools/security/redact-pdf"),
  );

  // H. PDF bytes remain local during redaction
  assert(
    "H export uses local client-export only",
    clientTool.includes("exportRedactedPdfFromWorkspace") &&
      !clientExportSource.includes("fetch("),
  );

  // I. old server implementation still exists
  assert(
    "I old server component exists",
    exists("components/tools/security/RedactPdfTool.tsx"),
  );
  assert(
    "I old PyMuPDF provider exists",
    exists("lib/providers/pdf/redaction/pymupdf-provider.ts"),
  );

  // J. old API still exists for rollback
  assert(
    "J old API route exists",
    exists("app/api/tools/security/redact-pdf/route.ts"),
  );
  assert(
    "J lazy rollback export retained",
    lazySource.includes("LazyRedactPdfTool"),
  );

  // K. canonical URL unchanged
  assert(
    "K canonical SEO path is /tools/redact-pdf",
    TOOL_SEO["redact-pdf"].path === "/tools/redact-pdf",
  );
  const homepageTool = HOMEPAGE_TOOLS.find((tool) => tool.id === "redact-pdf");
  assert(
    "K homepage tool href is /tools/redact-pdf",
    homepageTool?.href === "/tools/redact-pdf",
  );

  // L. canonical indexable
  assert(
    "L canonical path is in INDEXABLE_TOOL_PATHS",
    INDEXABLE_TOOL_PATHS.includes("/tools/redact-pdf"),
  );
  assert(
    "L canonical page uses createToolPageMetadata",
    canonicalPage.includes('createToolPageMetadata("redact-pdf")'),
  );
  assert(
    "L client test route is not in INDEXABLE_TOOL_PATHS",
    !INDEXABLE_TOOL_PATHS.includes("/tools/redact-pdf-client"),
  );

  // M. canonical discovery preserved
  const securityGrid = HOMEPAGE_CATEGORY_GRIDS.security.find(
    (item) => item.id === "redact-pdf",
  );
  assert(
    "M security grid preserves redact-pdf entry",
    securityGrid?.id === "redact-pdf",
  );
  assert(
    "M security grid Pro badge preserved",
    securityGrid?.proOnly === true,
  );
  assert(
    "M tool finder maps redact-pdf id",
    toolFinderSource.includes('"redact-pdf":'),
  );

  // N. Pro badge preserved in discovery (derived at runtime via buildHomepageGridItem)
  assert(
    "N buildHomepageGridItem derives proOnly from tool-access",
    homepageSource.includes("function buildHomepageGridItem") &&
      homepageSource.includes("proOnly: access?.requiresPro === true") &&
      homepageSource.includes('"redact-pdf"'),
  );
  assert(
    "N homepage security grid proOnly for redact-pdf",
    securityGrid?.proOnly === true && access?.requiresPro === true,
  );

  // O. no duplicate Redact tool
  const redactHomepageEntries = HOMEPAGE_TOOLS.filter((tool) =>
    tool.name.toLowerCase().includes("redact"),
  );
  assert(
    "O single Redact entry in HOMEPAGE_TOOLS",
    redactHomepageEntries.length === 1 && redactHomepageEntries[0]?.id === "redact-pdf",
  );
  const redactGridEntries = HOMEPAGE_CATEGORY_GRIDS.security.filter((item) =>
    item.name.toLowerCase().includes("redact"),
  );
  assert(
    "O single Redact entry in security grid",
    redactGridEntries.length === 1 && redactGridEntries[0]?.id === "redact-pdf",
  );

  // P. temp route remains noindex
  assert(
    "P client test route robots noindex",
    clientPage.includes("index: false") && clientPage.includes("follow: false"),
  );

  // Q. temp route absent sitemap
  assert(
    "Q sitemap uses INDEXABLE_TOOL_PATHS only",
    sitemapSource.includes("INDEXABLE_TOOL_PATHS"),
  );
  assert(
    "Q client test route not listed in TOOL_SEO",
    !Object.prototype.hasOwnProperty.call(TOOL_SEO, "redact-pdf-client"),
  );

  // R. temp route absent discovery
  assert(
    "R client test route not in HOMEPAGE_TOOLS",
    !HOMEPAGE_TOOLS.some((tool) => tool.id === "redact-pdf-client"),
  );
  assert(
    "R tool finder does not expose client test route",
    !toolFinderSource.includes("redact-pdf-client"),
  );

  // S. temp route cannot become public premium bypass
  assert(
    "S temp route uses Pro gate wrapper",
    clientPage.includes("RedactPdfProClientTool"),
  );
  assert(
    "S temp route does not render ungated client tool",
    !clientPage.includes("<RedactPdfClientTool") ||
      clientPage.includes("RedactPdfProClientTool"),
  );

  // T. 10 MB copy accurate
  const maxMb = Math.round(MAX_REDACT_PDF_BYTES / (1024 * 1024));
  assert("T MAX_REDACT_PDF_BYTES is 10 MB", maxMb === 10);
  assert(
    "T UI communicates 10 MB limit",
    clientTool.includes("10 MB") || clientTool.includes(`${maxMb}MB`),
  );
  assert("T SEO documents 10 MB limit", seoSource.includes("10 MB"));

  // U. no old 50 MB claim in canonical workflow
  assert(
    "U client tool has no 50 MB claim",
    !clientTool.includes("50 MB") && !clientTool.includes("50MB"),
  );
  assert(
    "U SEO has no 50 MB claim for redact-pdf",
    !seoSource.match(/"redact-pdf"[\s\S]{0,1200}50 MB/),
  );

  // V. no text-search claim if feature absent
  assert(
    "V SEO does not claim text search redaction",
    !seoSource.match(/"redact-pdf"[\s\S]{0,1200}search text/i) &&
      !seoSource.match(/"redact-pdf"[\s\S]{0,1200}Select text/i),
  );
  assert(
    "V SEO documents manual draw redaction",
    seoSource.includes("Draw redaction") || seoSource.includes("draw redaction"),
  );

  // W. security scope warning preserved
  assert(
    "W UI preserves sanitization limitation copy",
    clientTool.includes("REDACT_SANITIZATION_LIMITATION_COPY") &&
      REDACT_SANITIZATION_LIMITATION_COPY.includes(
        "Page-region redaction does not automatically remove document metadata",
      ),
  );
  assert(
    "W SEO documents sanitization limitation",
    seoSource.includes("Page-region redaction does not remove document metadata"),
  );

  // X. rasterization warning preserved
  assert(
    "X UI preserves raster quality copy",
    clientTool.includes("REDACT_RASTER_QUALITY_COPY") &&
      REDACT_RASTER_QUALITY_COPY.includes(
        "Pages containing redactions are rebuilt as images",
      ),
  );
  assert(
    "X SEO documents rasterization tradeoff",
    seoSource.includes("rebuilt as images"),
  );

  // Y. local-processing privacy copy accurate
  assert(
    "Y privacy copy matches canonical client message",
    clientTool.includes("REDACT_PRIVACY_COPY") &&
      REDACT_PRIVACY_COPY ===
        "Your PDF is redacted locally in your browser and is not uploaded to Scanonix servers for redaction processing.",
  );
  assert(
    "Y SEO mentions local browser processing",
    seoSource.includes("processed locally in your browser") ||
      seoSource.includes("local browser processing"),
  );

  // Z. other Pro tools unchanged
  assert("Z protect-pdf still requires Pro", getToolAccess("protect-pdf")?.requiresPro === true);
  assert("Z unlock-pdf still requires Pro", getToolAccess("unlock-pdf")?.requiresPro === true);
  assert(
    "Z metadata-cleaner still requires Pro",
    getToolAccess("metadata-cleaner")?.requiresPro === true,
  );
  assert(
    "Z protect-pdf still server-side",
    getToolAccess("protect-pdf")?.processing === "server",
  );
  assert(
    "Z watermark-pdf still free client",
    getToolAccess("watermark-pdf")?.requiresPro === false &&
      getToolAccess("watermark-pdf")?.processing === "client",
  );
  assert(
    "Z only redact-pdf processing changed to client among Pro security tools",
    TOOL_ACCESS["protect-pdf"].processing === "server" &&
      TOOL_ACCESS["unlock-pdf"].processing === "server" &&
      TOOL_ACCESS["metadata-cleaner"].processing === "server",
  );

  console.log(`\n125F migration: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
