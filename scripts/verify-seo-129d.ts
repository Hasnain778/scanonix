/**
 * OG / social preview image integration verification (Phase 129D).
 * Run: npx tsx scripts/verify-seo-129d.ts
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CANONICAL_SITE_ORIGIN,
  resolveCanonicalSiteUrl,
} from "../config/canonical-site-url";
import { SOCIAL_LINKS } from "../constants/social-links";
import { SCANONIX_TOOLS } from "../constants/tools-directory-data";

const WWW_ORIGIN = "https://www.scanonix.com";
const LINKEDIN_URL = "https://www.linkedin.com/company/scanonix/";
const GITHUB_URL = "https://github.com/Scanonix";
const OG_PUBLIC_PATH = "public/og-scanonix.png";
const OG_ABSOLUTE_URL = `${WWW_ORIGIN}/og-scanonix.png`;
const OG_ALT = "Scanonix — Online PDF, Image and AI Document Tools";

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

function readPngDimensions(relativePath: string): { width: number; height: number } | null {
  const fullPath = join(root, relativePath);
  if (!existsSync(fullPath)) return null;
  const buffer = readFileSync(fullPath);
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function getOgImageFromMetadata(
  metadata: Awaited<ReturnType<typeof import("../lib/utils/seo").createPageMetadata>>,
): { url: string; width?: number; height?: number; alt?: string } | null {
  const images = metadata.openGraph?.images;
  if (!images) return null;
  const first = Array.isArray(images) ? images[0] : images;
  if (!first) return null;
  if (typeof first === "string") return { url: first };
  if (first instanceof URL) return { url: first.toString() };
  return {
    url: String(first.url ?? ""),
    width: typeof first.width === "number" ? first.width : undefined,
    height: typeof first.height === "number" ? first.height : undefined,
    alt: typeof first.alt === "string" ? first.alt : undefined,
  };
}

function getTwitterImageFromMetadata(
  metadata: Awaited<ReturnType<typeof import("../lib/utils/seo").createPageMetadata>>,
): string {
  const images = metadata.twitter?.images;
  if (!images) return "";
  const first = Array.isArray(images) ? images[0] : images;
  if (!first) return "";
  if (typeof first === "string") return first;
  if (first instanceof URL) return first.toString();
  return String(first.url ?? "");
}

function resolveAbsoluteOgUrl(relativeOrAbsolute: string): string {
  if (relativeOrAbsolute.startsWith("http")) return relativeOrAbsolute;
  return `${resolveCanonicalSiteUrl()}${relativeOrAbsolute.startsWith("/") ? "" : "/"}${relativeOrAbsolute}`;
}

async function run() {
  (process.env as NodeJS.ProcessEnv & { NODE_ENV?: string }).NODE_ENV = "production";

  const { SITE } = await import("../config/site");
  const { createOrganizationJsonLd, createPageMetadata } = await import("../lib/utils/seo");
  const { createToolPageMetadata } = await import("../lib/utils/tool-page");

  console.log("\nOG / social preview image integration verification (Phase 129D)\n");

  // 1. OG image asset exists at public path
  assert("1 OG image file exists", existsSync(join(root, OG_PUBLIC_PATH)));

  const fileSize = existsSync(join(root, OG_PUBLIC_PATH))
    ? statSync(join(root, OG_PUBLIC_PATH)).size
    : 0;
  assert("1 OG image file size > 0", fileSize > 0, String(fileSize));

  const dimensions = readPngDimensions(OG_PUBLIC_PATH);
  assert("1 OG image is PNG", dimensions !== null);
  assert("1 OG image width is 1200", dimensions?.width === 1200, String(dimensions?.width));
  assert("1 OG image height is 630", dimensions?.height === 630, String(dimensions?.height));

  // 2. Central site config
  assert("2 SITE.defaultOgImage is /og-scanonix.png", SITE.defaultOgImage === "/og-scanonix.png");
  assert("2 SITE.defaultOgImageAlt is correct", SITE.defaultOgImageAlt === OG_ALT);
  assert("2 SITE.ogImageWidth is 1200", SITE.ogImageWidth === 1200);
  assert("2 SITE.ogImageHeight is 630", SITE.ogImageHeight === 630);
  assert(
    "2 SITE.defaultOgImage is not icon.png",
    !String(SITE.defaultOgImage).includes("icon.png"),
    SITE.defaultOgImage,
  );

  const seoSource = readFileSync(join(root, "lib/utils/seo.ts"), "utf8");
  assert(
    "2 createPageMetadata does not default to icon.png",
    !seoSource.includes('defaultOgImage = "/icon.png"') &&
      !seoSource.includes("defaultOgImage: \"/icon.png\""),
  );

  // 3. Homepage metadata
  const homeMetadata = createPageMetadata({
    title: "Free Online PDF, Image & AI Document Tools | Scanonix",
    description: SITE.description,
    path: "/",
  });
  const homeOg = getOgImageFromMetadata(homeMetadata);
  assert("3 homepage has exactly one OG image", homeOg !== null);
  assert(
    "3 homepage og:image resolves to www",
    resolveAbsoluteOgUrl(homeOg?.url ?? "") === OG_ABSOLUTE_URL,
    resolveAbsoluteOgUrl(homeOg?.url ?? ""),
  );
  assert("3 homepage og:image width is 1200", homeOg?.width === 1200, String(homeOg?.width));
  assert("3 homepage og:image height is 630", homeOg?.height === 630, String(homeOg?.height));
  assert("3 homepage og:image alt is correct", homeOg?.alt === OG_ALT, homeOg?.alt);
  assert(
    "3 homepage twitter:card is summary_large_image",
    (homeMetadata.twitter as { card?: string } | undefined)?.card === "summary_large_image",
  );
  assert(
    "3 homepage twitter:image resolves to www",
    resolveAbsoluteOgUrl(getTwitterImageFromMetadata(homeMetadata)) === OG_ABSOLUTE_URL,
    resolveAbsoluteOgUrl(getTwitterImageFromMetadata(homeMetadata)),
  );

  // 4. Representative tool metadata inherits central OG
  const toolMetadata = createToolPageMetadata("merge-pdf");
  const toolOg = getOgImageFromMetadata(toolMetadata);
  assert(
    "4 merge-pdf og:image resolves to www",
    resolveAbsoluteOgUrl(toolOg?.url ?? "") === OG_ABSOLUTE_URL,
    resolveAbsoluteOgUrl(toolOg?.url ?? ""),
  );
  assert("4 merge-pdf og:image width is 1200", toolOg?.width === 1200);
  assert("4 merge-pdf og:image height is 630", toolOg?.height === 630);
  assert("4 merge-pdf og:image alt is correct", toolOg?.alt === OG_ALT);
  assert(
    "4 merge-pdf twitter:card is summary_large_image",
    (toolMetadata.twitter as { card?: string } | undefined)?.card === "summary_large_image",
  );
  assert(
    "4 merge-pdf twitter:image resolves to www",
    resolveAbsoluteOgUrl(getTwitterImageFromMetadata(toolMetadata)) === OG_ABSOLUTE_URL,
  );

  // 5. All 36 tools inherit central OG (no per-tool overrides)
  assert("5 tools directory count is 36", SCANONIX_TOOLS.length === 36);
  for (const tool of SCANONIX_TOOLS) {
    const metadata = createToolPageMetadata(tool.id);
    const og = getOgImageFromMetadata(metadata);
    assert(
      `5 tool ${tool.href} inherits central OG image`,
      resolveAbsoluteOgUrl(og?.url ?? "") === OG_ABSOLUTE_URL,
      resolveAbsoluteOgUrl(og?.url ?? ""),
    );
    assert(
      `5 tool ${tool.href} has single OG image entry`,
      Array.isArray(metadata.openGraph?.images)
        ? metadata.openGraph!.images!.length === 1
        : metadata.openGraph?.images !== undefined,
    );
  }

  // 6. No duplicate OG image declarations in createPageMetadata
  const ogImageArrayMatches = (seoSource.match(/images:\s*\[/g) ?? []).length;
  assert(
    "6 createPageMetadata declares OG images once",
    ogImageArrayMatches === 2,
    `found ${ogImageArrayMatches} image arrays (openGraph + twitter)`,
  );
  const createPageMetadataSource = seoSource.match(
    /export function createPageMetadata[\s\S]*?^}/m,
  )?.[0] ?? "";
  assert(
    "6 no icon.png in createPageMetadata openGraph images",
    !createPageMetadataSource.includes("icon.png"),
  );

  // 7. Canonical www unchanged
  assert("7 CANONICAL_SITE_ORIGIN is www", CANONICAL_SITE_ORIGIN === WWW_ORIGIN);
  assert(
    "7 production siteUrl resolves to www",
    resolveCanonicalSiteUrl() === WWW_ORIGIN,
  );
  const homeCanonical = String(homeMetadata.alternates?.canonical ?? "");
  assert(
    "7 homepage canonical uses www",
    homeCanonical.startsWith(WWW_ORIGIN) && !homeCanonical.includes("://scanonix.com"),
    homeCanonical,
  );

  // 8. Organization sameAs unchanged
  const orgJsonLd = createOrganizationJsonLd();
  assert(
    "8 Organization sameAs includes LinkedIn",
    Array.isArray(orgJsonLd.sameAs) && orgJsonLd.sameAs.includes(LINKEDIN_URL),
  );
  assert(
    "8 Organization sameAs includes GitHub",
    Array.isArray(orgJsonLd.sameAs) && orgJsonLd.sameAs.includes(GITHUB_URL),
  );
  assert(
    "8 Organization sameAs matches SOCIAL_LINKS",
    Array.isArray(orgJsonLd.sameAs) &&
      orgJsonLd.sameAs.length === SOCIAL_LINKS.length &&
      SOCIAL_LINKS.every((link) => orgJsonLd.sameAs.includes(link.href)),
  );
  assert(
    "8 Organization logo still uses icon.png (favicon, not OG)",
    orgJsonLd.logo === `${WWW_ORIGIN}/icon.png`,
    String(orgJsonLd.logo),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
