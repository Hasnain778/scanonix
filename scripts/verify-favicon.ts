/**
 * Favicon compatibility verification (Phase 129D-FIX1).
 * Run: npx tsx scripts/verify-favicon.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CANONICAL_SITE_ORIGIN,
  resolveCanonicalSiteUrl,
} from "../config/canonical-site-url";
import { SOCIAL_LINKS } from "../constants/social-links";

const WWW_ORIGIN = "https://www.scanonix.com";
const LINKEDIN_URL = "https://www.linkedin.com/company/scanonix/";
const GITHUB_URL = "https://github.com/Scanonix";
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

function readIcoDimensions(buffer: Buffer): number[] {
  if (buffer.length < 6 || buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) {
    return [];
  }
  const count = buffer.readUInt16LE(4);
  const sizes: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const offset = 6 + i * 16;
    if (offset + 16 > buffer.length) break;
    const width = buffer[offset] === 0 ? 256 : buffer[offset];
    const height = buffer[offset + 1] === 0 ? 256 : buffer[offset + 1];
    if (width === height) sizes.push(width);
  }
  return sizes;
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

function resolveAbsoluteOgUrl(relativeOrAbsolute: string): string {
  if (relativeOrAbsolute.startsWith("http")) return relativeOrAbsolute;
  return `${resolveCanonicalSiteUrl()}${relativeOrAbsolute.startsWith("/") ? "" : "/"}${relativeOrAbsolute}`;
}

async function run() {
  (process.env as NodeJS.ProcessEnv & { NODE_ENV?: string }).NODE_ENV = "production";

  const { SITE } = await import("../config/site");
  const { createOrganizationJsonLd, createPageMetadata } = await import("../lib/utils/seo");
  const layoutSource = readFileSync(join(root, "app", "layout.tsx"), "utf8");

  console.log("\nFavicon compatibility verification (Phase 129D-FIX1)\n");

  // 1. favicon.ico exists and is valid ICO
  const faviconPath = join(root, "app", "favicon.ico");
  assert("1 app/favicon.ico exists", existsSync(faviconPath));

  const faviconBuffer = existsSync(faviconPath) ? readFileSync(faviconPath) : Buffer.alloc(0);
  assert("1 favicon.ico file size > 0", faviconBuffer.length > 0, String(faviconBuffer.length));
  assert(
    "1 favicon.ico has ICO magic bytes",
    faviconBuffer.length >= 4 &&
      faviconBuffer.readUInt16LE(0) === 0 &&
      faviconBuffer.readUInt16LE(2) === 1,
  );

  const icoSizes = readIcoDimensions(faviconBuffer);
  assert("1 favicon.ico contains 16x16", icoSizes.includes(16), icoSizes.join(", "));
  assert("1 favicon.ico contains 32x32", icoSizes.includes(32), icoSizes.join(", "));
  assert("1 favicon.ico contains 48x48", icoSizes.includes(48), icoSizes.join(", "));

  // 2. icon.png remains available
  assert("2 app/icon.png exists", existsSync(join(root, "app", "icon.png")));
  assert(
    "2 public/scanonix_icon.png exists",
    existsSync(join(root, "public", "scanonix_icon.png")),
  );

  // 3. Root layout icons metadata
  assert("3 layout declares /favicon.ico", layoutSource.includes('url: "/favicon.ico"'));
  assert(
    "3 layout declares /icon.png with sizes",
    layoutSource.includes('url: "/icon.png"') &&
      layoutSource.includes('sizes: "1024x1024"'),
  );
  assert("3 layout apple icon is /icon.png", layoutSource.includes('apple: "/icon.png"'));
  assert(
    "3 layout has no conflicting shortcut icon override",
    !layoutSource.includes('shortcut:') && !layoutSource.includes("shortcut icon"),
  );

  // 4. Canonical www unchanged
  assert("4 CANONICAL_SITE_ORIGIN is www", CANONICAL_SITE_ORIGIN === WWW_ORIGIN);
  assert("4 production siteUrl resolves to www", resolveCanonicalSiteUrl() === WWW_ORIGIN);

  const homeMetadata = createPageMetadata({
    title: "Free Online PDF, Image & AI Document Tools | Scanonix",
    description: SITE.description,
    path: "/",
  });
  const homeCanonical = String(homeMetadata.alternates?.canonical ?? "");
  assert(
    "4 homepage canonical uses www",
    homeCanonical.startsWith(WWW_ORIGIN) && !homeCanonical.includes("://scanonix.com"),
    homeCanonical,
  );

  // 5. OG / Twitter unchanged (129D)
  const homeOg = getOgImageFromMetadata(homeMetadata);
  assert(
    "5 homepage og:image resolves to www og-scanonix",
    resolveAbsoluteOgUrl(homeOg?.url ?? "") === OG_ABSOLUTE_URL,
    resolveAbsoluteOgUrl(homeOg?.url ?? ""),
  );
  assert("5 homepage og:image width is 1200", homeOg?.width === 1200);
  assert("5 homepage og:image height is 630", homeOg?.height === 630);
  assert("5 homepage og:image alt is correct", homeOg?.alt === OG_ALT);
  assert(
    "5 homepage twitter:card is summary_large_image",
    (homeMetadata.twitter as { card?: string } | undefined)?.card === "summary_large_image",
  );

  // 6. Organization sameAs unchanged
  const orgJsonLd = createOrganizationJsonLd();
  assert(
    "6 Organization sameAs includes LinkedIn",
    Array.isArray(orgJsonLd.sameAs) && orgJsonLd.sameAs.includes(LINKEDIN_URL),
  );
  assert(
    "6 Organization sameAs includes GitHub",
    Array.isArray(orgJsonLd.sameAs) && orgJsonLd.sameAs.includes(GITHUB_URL),
  );
  assert(
    "6 Organization sameAs matches SOCIAL_LINKS",
    Array.isArray(orgJsonLd.sameAs) &&
      orgJsonLd.sameAs.length === SOCIAL_LINKS.length &&
      SOCIAL_LINKS.every((link) => orgJsonLd.sameAs.includes(link.href)),
  );
  assert(
    "6 Organization logo still uses icon.png",
    orgJsonLd.logo === `${WWW_ORIGIN}/icon.png`,
    String(orgJsonLd.logo),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
