/**
 * SEO measurement + structured data + copy integrity (Phase 129C).
 * Run: npx tsx scripts/verify-seo-129c.ts
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  CANONICAL_SITE_ORIGIN,
  resolveCanonicalSiteUrl,
} from "../config/canonical-site-url";
import { SOCIAL_LINKS } from "../constants/social-links";
import { TOOL_SEO } from "../constants/tool-seo";
import { SCANONIX_TOOLS } from "../constants/tools-directory-data";
import { TOOL_ACCESS } from "../lib/plan/tool-access";

const WWW_ORIGIN = "https://www.scanonix.com";
const LINKEDIN_URL = "https://www.linkedin.com/company/scanonix/";
const GITHUB_URL = "https://github.com/Scanonix";

const TEMP_ROUTE_PREFIXES = [
  "/api/",
  "/admin/",
  "/dashboard/",
  "/account/",
  "/monitors/",
  "/scan-history/",
  "/scan-results/",
  "/history/",
  "/saved-files/",
  "/login",
  "/register",
  "/auth/",
  "/forgot-password",
  "/reset-password",
  "/billing/",
];

const PRO_TOOL_IDS = Object.entries(TOOL_ACCESS)
  .filter(([, cfg]) => cfg.requiresPro)
  .map(([id]) => id);

const PRO_INDEXABLE_TOOL_IDS = PRO_TOOL_IDS.filter((id) => Boolean(TOOL_SEO[id]));

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

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function getPathFromPage(relativePath: string): string | undefined {
  const source = readSource(relativePath);
  const pathMatch = source.match(/createPageMetadata\(\{[\s\S]*?path:\s*"([^"]+)"/);
  return pathMatch?.[1];
}

function countMatches(source: string, pattern: RegExp): number {
  return (source.match(pattern) ?? []).length;
}

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkTsFiles(fullPath, acc);
    } else if (/\.(tsx?|jsx?|mjs)$/.test(entry.name)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function hasMisleadingProFreeClaim(toolId: string): string | null {
  const seo = TOOL_SEO[toolId];
  if (!seo) return `missing TOOL_SEO entry`;

  const freePattern = /\bfree\b/i;
  const fields: Array<[string, string]> = [
    ["seoTitle", seo.seoTitle],
    ["metaDescription", seo.metaDescription],
    ["h1", seo.h1],
  ];

  for (const [field, value] of fields) {
    if (freePattern.test(value)) {
      return `${field} contains "free": ${value}`;
    }
  }

  if (seo.keywords?.some((kw) => freePattern.test(kw))) {
    return `keywords contain "free": ${seo.keywords.join(", ")}`;
  }

  return null;
}

async function run() {
  (process.env as NodeJS.ProcessEnv & { NODE_ENV?: string }).NODE_ENV = "production";

  const { createOrganizationJsonLd, createWebSiteJsonLd, createPageMetadata } =
    await import("../lib/utils/seo");

  console.log("\nSEO measurement + structured data + copy integrity (Phase 129C)\n");

  // 1. Canonical www + legal self-canonical
  const privacyPath = getPathFromPage("app/privacy/page.tsx");
  const termsPath = getPathFromPage("app/terms/page.tsx");
  const contactPath = getPathFromPage("app/contact/page.tsx");

  assert("1 privacy canonical is self (not /)", privacyPath === "/privacy", privacyPath ?? "missing");
  assert("1 terms canonical is self (not /)", termsPath === "/terms", termsPath ?? "missing");
  assert("1 contact canonical is self (not /)", contactPath === "/contact", contactPath ?? "missing");
  assert("1 CANONICAL_SITE_ORIGIN is www", CANONICAL_SITE_ORIGIN === WWW_ORIGIN);
  assert(
    "1 production siteUrl resolves to www",
    resolveCanonicalSiteUrl() === WWW_ORIGIN,
  );

  for (const path of ["/privacy", "/terms", "/contact"]) {
    const metadata = createPageMetadata({ title: "Test", description: "Test", path });
    const canonical = String(metadata.alternates?.canonical ?? "");
    assert(
      `1 ${path} canonical uses www`,
      canonical.startsWith(WWW_ORIGIN) && !canonical.includes("://scanonix.com"),
      canonical,
    );
  }

  // 2. /tools SSR H1
  const heroHeaderSource = readSource("components/tools/directory/ToolsDirectoryHeroHeader.tsx");
  const toolsDirectorySource = readSource("components/tools/directory/ToolsDirectory.tsx");
  const toolsPageSource = readSource("app/tools/page.tsx");

  assert(
    "2 /tools has exactly one H1 source (server hero header)",
    countMatches(heroHeaderSource, /<h1\b/g) === 1 &&
      countMatches(toolsDirectorySource, /<h1\b/g) === 0,
  );
  assert(
    "2 tools H1 lives in server component",
    !heroHeaderSource.includes('"use client"') && heroHeaderSource.includes("<h1"),
  );
  const toolsPageBody = toolsPageSource.slice(toolsPageSource.indexOf("export default"));
  assert(
    "2 tools page renders server hero header with SSR directory",
    toolsPageBody.includes("ToolsDirectoryHeroHeader") &&
      toolsPageBody.includes("ToolsDirectory") &&
      toolsPageBody.includes("initialCategory") &&
      !toolsPageBody.includes("<Suspense"),
  );

  // 3. Organization JSON-LD
  const orgJsonLd = createOrganizationJsonLd();
  assert("3 Organization name is Scanonix", orgJsonLd.name === "Scanonix");
  assert("3 Organization url is www", orgJsonLd.url === WWW_ORIGIN, String(orgJsonLd.url));
  assert(
    "3 Organization logo uses www icon.png",
    orgJsonLd.logo === `${WWW_ORIGIN}/icon.png`,
    String(orgJsonLd.logo),
  );
  assert(
    "3 Organization sameAs includes LinkedIn",
    Array.isArray(orgJsonLd.sameAs) && orgJsonLd.sameAs.includes(LINKEDIN_URL),
  );
  assert(
    "3 Organization sameAs includes GitHub",
    Array.isArray(orgJsonLd.sameAs) && orgJsonLd.sameAs.includes(GITHUB_URL),
  );
  assert(
    "3 Organization sameAs matches SOCIAL_LINKS",
    Array.isArray(orgJsonLd.sameAs) &&
      orgJsonLd.sameAs.length === SOCIAL_LINKS.length &&
      SOCIAL_LINKS.every((link) => orgJsonLd.sameAs.includes(link.href)),
  );

  const layoutSource = readSource("app/layout.tsx");
  const orgJsonLdCallCount = countMatches(layoutSource, /createOrganizationJsonLd\(\)/g);
  assert(
    "3 exactly one Organization JSON-LD injection in layout",
    orgJsonLdCallCount === 1,
    `found ${orgJsonLdCallCount}`,
  );

  const repoSources = walkTsFiles(root).map((file) => readFileSync(file, "utf8"));
  const orgTypeCount = repoSources.reduce(
    (sum, source) => sum + countMatches(source, /"@type":\s*"Organization"/g),
    0,
  );
  assert(
    "3 no duplicate Organization @type literals in source",
    orgTypeCount <= 1,
    `found ${orgTypeCount}`,
  );

  // 4. WebSite JSON-LD
  const websiteJsonLd = createWebSiteJsonLd();
  assert("4 WebSite name is Scanonix", websiteJsonLd.name === "Scanonix");
  assert("4 WebSite url is www", websiteJsonLd.url === WWW_ORIGIN, String(websiteJsonLd.url));
  assert(
    "4 WebSite has no fake SearchAction",
    !("potentialAction" in websiteJsonLd) &&
      !readSource("lib/utils/seo.ts").includes("SearchAction"),
  );

  // 5. Sitemap www + temp routes excluded
  const sitemapSource = readSource("app/sitemap.ts");
  const robotsSource = readSource("app/robots.ts");
  assert("5 sitemap derives base from env.siteUrl", sitemapSource.includes("env.siteUrl"));
  assert(
    "5 sitemap has no hardcoded bare scanonix.com",
    !sitemapSource.includes('"https://scanonix.com"'),
  );

  for (const prefix of TEMP_ROUTE_PREFIXES) {
    assert(
      `5 temp route ${prefix} disallowed in robots`,
      robotsSource.includes(`"${prefix}"`) || robotsSource.includes(`'${prefix}'`),
    );
    assert(
      `5 temp route ${prefix} not in sitemap static paths`,
      !sitemapSource.includes(`"${prefix.replace(/\/$/, "")}"`),
    );
  }

  // 6. Pro/free copy integrity
  assert(
    "6 pdf-to-word keywords omit misleading free claim",
    !TOOL_SEO["pdf-to-word"]?.keywords?.some((kw) => /\bfree\b/i.test(kw)),
  );
  assert(
    "6 ai-summary seoTitle omits misleading free claim",
    !/\bfree\b/i.test(TOOL_SEO["ai-summary"]?.seoTitle ?? ""),
    TOOL_SEO["ai-summary"]?.seoTitle,
  );
  assert(
    "6 ai-summary FAQ states Pro requirement",
    TOOL_SEO["ai-summary"]?.faqs.some(
      (faq) => /pro feature/i.test(faq.answer) && /free/i.test(faq.question),
    ) ?? false,
  );

  for (const toolId of PRO_INDEXABLE_TOOL_IDS) {
    const issue = hasMisleadingProFreeClaim(toolId);
    assert(`6 Pro tool ${toolId} has no misleading free claims`, issue === null, issue ?? "");
  }

  // 7. Tool schema coverage (36 directory tools)
  assert("7 tools directory count is 36", SCANONIX_TOOLS.length === 36);

  for (const tool of SCANONIX_TOOLS) {
    const seoId = tool.id;
    assert(`7 tool ${tool.href} has TOOL_SEO entry`, Boolean(TOOL_SEO[seoId]));
    assert(
      `7 tool ${tool.href} path matches TOOL_SEO`,
      TOOL_SEO[seoId]?.path === tool.href,
      `${TOOL_SEO[seoId]?.path} vs ${tool.href}`,
    );
  }

  const toolRouteSource = readSource("components/workspace/ToolRoute.tsx");
  assert(
    "7 ToolRoute emits createToolJsonLd",
    toolRouteSource.includes("createToolJsonLd"),
  );

  // 8. No duplicate analytics scripts
  const analyticsPatterns = [
    /googletagmanager\.com/,
    /google-analytics\.com/,
    /gtag\s*\(/,
    /@vercel\/analytics/,
    /SpeedInsights/,
    /NEXT_PUBLIC_GA_MEASUREMENT_ID/,
  ];
  const appSources = [
    readSource("app/layout.tsx"),
    readSource("app/providers.tsx"),
    ...walkTsFiles(join(root, "components")).map((file) => readFileSync(file, "utf8")),
  ].join("\n");

  for (const pattern of analyticsPatterns) {
    assert(`8 no analytics pattern ${pattern}`, !pattern.test(appSources));
  }

  assert(
    "8 GA4 env template absent (BLOCKED_PENDING_MEASUREMENT_ID)",
    !readSource(".env.local.example").includes("NEXT_PUBLIC_GA") &&
      !readSource(".env.local.example").includes("G-"),
  );

  // 9. GSC verification preserved (audit only — do not add meta)
  assert(
    "9 no google-site-verification meta added to layout",
    !layoutSource.includes("google-site-verification"),
  );
  assert(
    "9 GSC verification documented as external",
    readSource("docs/seo/ANALYTICS-DECISION.md").includes("EXTERNAL"),
  );

  // 10. Social footer sameAs alignment
  assert(
    "10 footer social LinkedIn matches Organization sameAs",
    SOCIAL_LINKS.some((link) => link.href === LINKEDIN_URL),
  );
  assert(
    "10 footer social GitHub matches Organization sameAs",
    SOCIAL_LINKS.some((link) => link.href === GITHUB_URL),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
