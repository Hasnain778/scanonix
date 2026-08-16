/**
 * Canonical host alignment verification (Phase 129B-FIX1).
 * Run: npx tsx scripts/verify-seo-canonical-host.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CANONICAL_SITE_ORIGIN,
  resolveCanonicalSiteUrl,
} from "../config/canonical-site-url";
import { INDEXABLE_TOOL_PATHS } from "../constants/tool-seo";
import { SCANONIX_TOOLS } from "../constants/tools-directory-data";
import {
  getToolsCategoryHref,
  parseToolsCategoryParam,
} from "../lib/navigation/tool-category-urls";

const WWW_ORIGIN = "https://www.scanonix.com";

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

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const root = process.cwd();

async function run() {
  (process.env as NodeJS.ProcessEnv & { NODE_ENV?: string }).NODE_ENV = "production";

  const { createPageMetadata } = await import("../lib/utils/seo");
  const { createToolPageMetadata } = await import("../lib/utils/tool-page");

  console.log("\nCanonical host alignment verification (Phase 129B-FIX1)\n");

  // 1. Central config
  assert("1 CANONICAL_SITE_ORIGIN is www", CANONICAL_SITE_ORIGIN === WWW_ORIGIN);
  assert(
    "1 resolveCanonicalSiteUrl() defaults to www in production",
    resolveCanonicalSiteUrl() === WWW_ORIGIN,
  );
  assert(
    "1 bare scanonix.com input normalizes to www",
    resolveCanonicalSiteUrl("https://scanonix.com") === WWW_ORIGIN,
  );
  assert(
    "1 www input stays www",
    resolveCanonicalSiteUrl("https://www.scanonix.com") === WWW_ORIGIN,
  );
  assert(
    "1 CANONICAL_SITE_ORIGIN includes www subdomain",
    CANONICAL_SITE_ORIGIN.includes("www.scanonix.com"),
  );

  function getCanonicalFromMetadata(
    metadata: Awaited<ReturnType<typeof createPageMetadata>>,
  ): string {
    const canonical = metadata.alternates?.canonical;
    if (typeof canonical === "string") return canonical;
    if (canonical && typeof canonical === "object" && "url" in canonical) {
      return String(canonical.url);
    }
    return "";
  }

  function getOgUrlFromMetadata(
    metadata: Awaited<ReturnType<typeof createPageMetadata>>,
  ): string {
    return String(metadata.openGraph?.url ?? "");
  }

  // 2. Static pages via createPageMetadata
  const staticPages: Array<{ label: string; path: string }> = [
    { label: "homepage", path: "/" },
    { label: "/tools", path: "/tools" },
    { label: "privacy", path: "/privacy" },
    { label: "terms", path: "/terms" },
    { label: "contact", path: "/contact" },
  ];

  for (const { label, path } of staticPages) {
    const metadata = createPageMetadata({
      title: "Test",
      description: "Test",
      path,
    });
    const canonical = getCanonicalFromMetadata(metadata);
    const ogUrl = getOgUrlFromMetadata(metadata);
    assert(
      `2 ${label} canonical uses www`,
      canonical.startsWith(WWW_ORIGIN),
      canonical,
    );
    assert(
      `2 ${label} og:url uses www`,
      ogUrl.startsWith(WWW_ORIGIN),
      ogUrl,
    );
    assert(
      `2 ${label} canonical has no bare scanonix.com`,
      !canonical.includes("://scanonix.com"),
      canonical,
    );
    assert(
      `2 ${label} canonical has no localhost`,
      !canonical.includes("localhost"),
      canonical,
    );
  }

  // 3. Representative tool + all 36 directory tools
  assert("3 tools directory count is 36", SCANONIX_TOOLS.length === 36);

  const repMetadata = createToolPageMetadata("merge-pdf");
  const repCanonical = getCanonicalFromMetadata(repMetadata);
  assert(
    "3 representative tool (merge-pdf) canonical uses www",
    repCanonical.startsWith(WWW_ORIGIN),
    repCanonical,
  );

  for (const tool of SCANONIX_TOOLS) {
    const metadata = createPageMetadata({
      title: "Tool",
      description: "Tool",
      path: tool.href,
    });
    const canonical = getCanonicalFromMetadata(metadata);
    assert(
      `3 tool ${tool.href} canonical uses www`,
      canonical.startsWith(WWW_ORIGIN) && !canonical.includes("://scanonix.com"),
      canonical,
    );
  }

  // 4. Sitemap uses www through env.siteUrl
  const sitemapSource = readSource("app/sitemap.ts");
  assert(
    "4 sitemap derives base from env.siteUrl",
    sitemapSource.includes("env.siteUrl"),
  );
  assert(
    "4 sitemap has no hardcoded bare scanonix.com",
    !sitemapSource.includes('"https://scanonix.com"'),
  );

  const prodSiteUrl = resolveCanonicalSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  assert("4 production siteUrl resolves to www", prodSiteUrl === WWW_ORIGIN);

  for (const path of ["/", "/tools", "/privacy", "/terms", "/contact", ...INDEXABLE_TOOL_PATHS]) {
    const url = `${prodSiteUrl}${path === "/" ? "" : path}`;
    assert(
      `4 sitemap URL ${path || "/"} uses www`,
      url.startsWith(WWW_ORIGIN) && !url.includes("://scanonix.com"),
      url,
    );
  }

  // 5. Structured data uses SITE.url (www)
  const seoSource = readSource("lib/utils/seo.ts");
  assert(
    "5 JSON-LD uses SITE.url (not hardcoded bare)",
    seoSource.includes("url: SITE.url") && !seoSource.includes('"https://scanonix.com"'),
  );

  // 6. Category routing unchanged
  assert(
    "6 All Tools href resolves to /tools",
    getToolsCategoryHref("all") === "/tools",
  );
  for (const category of ["pdf", "image", "ai", "security"] as const) {
    assert(
      `6 category ${category} href preserved`,
      getToolsCategoryHref(category) === `/tools?category=${category}`,
    );
    assert(
      `6 parseToolsCategoryParam("${category}") preserved`,
      parseToolsCategoryParam(category) === category,
    );
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
