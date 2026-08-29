/**
 * Favicon verification (Phase 130C-FAV2).
 * Run: npm run verify:favicon
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CANONICAL_SITE_ORIGIN,
  resolveCanonicalSiteUrl,
} from "../config/canonical-site-url";
import { SOCIAL_LINKS } from "../constants/social-links";

const WWW_ORIGIN = "https://www.scanonix.com";

/**
 * Frozen favicon.ico SHA-256 (Phase 130L-4R6 / 4R6B / 4F).
 * Transparent standalone-S ICO — do not weaken occupancy/orange checks when updating.
 */
export const FROZEN_FAVICON_SHA256 =
  "ba054129ed250215f62418b4266e99126e226f031a8e2defbf543757763bb215";

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

function decodeIcoBmpToRgba(buffer: Buffer, expectedSize: number): Buffer {
  const width = buffer.readInt32LE(4);
  const pixelHeight = buffer.readInt32LE(8) / 2;
  const bitCount = buffer.readUInt16LE(14);
  const rowBytes = Math.floor((width * bitCount + 31) / 32) * 4;
  const offset = 40;
  const rgba = Buffer.alloc(width * pixelHeight * 4);
  for (let y = 0; y < pixelHeight; y += 1) {
    const srcY = pixelHeight - 1 - y;
    for (let x = 0; x < width; x += 1) {
      const src = offset + srcY * rowBytes + x * 4;
      const dst = (y * width + x) * 4;
      rgba[dst] = buffer[src + 2];
      rgba[dst + 1] = buffer[src + 1];
      rgba[dst + 2] = buffer[src];
      rgba[dst + 3] = buffer[src + 3];
    }
  }
  if (width !== expectedSize || pixelHeight !== expectedSize) {
    throw new Error(`Unexpected ICO frame size ${width}x${pixelHeight}, expected ${expectedSize}`);
  }
  return rgba;
}

function readIcoFrameRgba(buffer: Buffer, size: number): Buffer | null {
  if (buffer.length < 6 || buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) {
    return null;
  }
  const count = buffer.readUInt16LE(4);
  for (let i = 0; i < count; i += 1) {
    const offset = 6 + i * 16;
    const width = buffer[offset] === 0 ? 256 : buffer[offset];
    if (width !== size) continue;
    const dataSize = buffer.readUInt32LE(offset + 8);
    const dataOffset = buffer.readUInt32LE(offset + 12);
    const slice = buffer.subarray(dataOffset, dataOffset + dataSize);
    return decodeIcoBmpToRgba(slice, size);
  }
  return null;
}

function classifyFaviconPixel(r: number, g: number, b: number, a: number): number {
  if (a < 128) return 0;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum > 185 && r > 170 && g > 170 && b > 170) return 2;
  if (lum > 45) return 1;
  return 0;
}

function markOccupancyFromRgba(rgba: Buffer): number {
  let mark = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (classifyFaviconPixel(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]) !== 0) {
      mark += 1;
    }
  }
  return (mark / (rgba.length / 4)) * 100;
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
  const {
    createOrganizationJsonLd,
    createPageMetadata,
    createWebSiteJsonLd,
  } = await import("../lib/utils/seo");
  const layoutSource = readFileSync(join(root, "app", "layout.tsx"), "utf8");
  const pageSource = readFileSync(join(root, "app", "page.tsx"), "utf8");
  const ga4Source = existsSync(join(root, "lib", "analytics", "ga4.ts"))
    ? readFileSync(join(root, "lib", "analytics", "ga4.ts"), "utf8")
    : "";

  console.log("\nFavicon verification (Phase 130C-FAV2)\n");

  // 1. favicon assets
  const faviconPath = join(root, "app", "favicon.ico");
  assert("1 app/favicon.ico exists", existsSync(faviconPath));
  assert("1 app/favicon-source.png exists", existsSync(join(root, "app", "favicon-source.png")));

  const faviconBuffer = existsSync(faviconPath) ? readFileSync(faviconPath) : Buffer.alloc(0);
  assert("1 favicon.ico file size > 0", faviconBuffer.length > 0, String(faviconBuffer.length));
  assert(
    "1 favicon.ico has ICO magic bytes",
    faviconBuffer.length >= 4 &&
      faviconBuffer.readUInt16LE(0) === 0 &&
      faviconBuffer.readUInt16LE(2) === 1,
  );

  const faviconSha = createHash("sha256").update(faviconBuffer).digest("hex");
  assert(
    "1 favicon.ico matches frozen SHA-256",
    faviconSha === FROZEN_FAVICON_SHA256,
    `got ${faviconSha}`,
  );

  const icoSizes = readIcoDimensions(faviconBuffer);
  assert("1 favicon.ico contains 16x16", icoSizes.includes(16), icoSizes.join(", "));
  assert("1 favicon.ico contains 32x32", icoSizes.includes(32), icoSizes.join(", "));
  assert("1 favicon.ico contains 48x48", icoSizes.includes(48), icoSizes.join(", "));

  // 2. large brand assets preserved
  assert("2 app/icon.png exists", existsSync(join(root, "app", "icon.png")));
  assert(
    "2 public/scanonix_icon.png exists",
    existsSync(join(root, "public", "scanonix_icon.png")),
  );
  assert(
    "2 public/scanonix_mark.png exists (standalone transparent S)",
    existsSync(join(root, "public", "scanonix_mark.png")),
  );

  // 3. consolidated metadata — filesystem favicon only for Search
  assert(
    "3 layout has no manual general icon metadata",
    !layoutSource.includes('icon: [') && !layoutSource.includes('url: "/favicon.ico"'),
  );
  assert(
    "3 layout does not expose /icon.png as general favicon",
    !layoutSource.includes('url: "/icon.png"') &&
      !layoutSource.includes('sizes: "1024x1024"'),
  );
  assert("3 layout apple icon is /icon.png", layoutSource.includes('apple: "/icon.png"'));
  assert(
    "3 layout has no conflicting shortcut icon override",
    !layoutSource.includes("shortcut:") && !layoutSource.includes("shortcut icon"),
  );
  assert("3 app/favicon.ico filesystem asset exists", existsSync(faviconPath));

  // 4. canonical www unchanged
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

  // 5. OG / Twitter unchanged
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

  // 6. structured data preserved
  const orgJsonLd = createOrganizationJsonLd();
  const websiteJsonLd = createWebSiteJsonLd();
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
  assert("6 WebSite schema name preserved", websiteJsonLd.name === "Scanonix");
  assert("6 WebSite schema url preserved", websiteJsonLd.url === WWW_ORIGIN);
  assert("6 homepage renders WebSite JSON-LD", pageSource.includes("createWebSiteJsonLd"));

  // 7. analytics freeze
  assert("7 ga4 module untouched", ga4Source.includes("send_page_view: false"));
  assert("7 no analytics edits in layout", !layoutSource.includes("GoogleAnalytics"));

  // 8. generator script uses approved O2 antialiased pipeline (130G-9)
  const generatorSource = readFileSync(join(root, "scripts", "generate-favicon.mjs"), "utf8");
  assert("8 generator uses favicon-source.png", generatorSource.includes("favicon-source.png"));
  assert("8 generator preserves approved icon.png source", generatorSource.includes("icon.png"));
  assert("8 generator uses approved O2 crop", generatorSource.includes("O2_CROP"));
  assert("8 generator uses Lanczos3", generatorSource.includes("lanczos3"));
  assert(
    "8 generator has no posterization pipeline",
    !generatorSource.includes("posterizeGrid") &&
      !generatorSource.includes("FRAME_PROFILES") &&
      !generatorSource.includes("kernel.nearest"),
  );
  assert("8 generator uses RGBA-safe render", generatorSource.includes("ensureAlpha"));

  // 9. favicon frame visual sanity (130G-3)
  const minOccupancy: Record<number, number> = { 16: 20, 32: 18, 48: 18 };
  for (const size of [16, 32, 48] as const) {
    const rgba = readIcoFrameRgba(faviconBuffer, size);
    assert(`9 ${size}x${size} frame decodable`, rgba !== null);
    if (!rgba) continue;
    const occupancy = markOccupancyFromRgba(rgba);
    assert(
      `9 ${size}x${size} mark occupancy >= ${minOccupancy[size]}%`,
      occupancy >= minOccupancy[size],
      `${occupancy.toFixed(1)}%`,
    );
    let orange = 0;
    for (let i = 0; i < rgba.length; i += 4) {
      if (classifyFaviconPixel(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]) === 1) {
        orange += 1;
      }
    }
    assert(
      `9 ${size}x${size} has orange mark pixels`,
      orange >= Math.max(4, Math.floor(size)),
      String(orange),
    );
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
