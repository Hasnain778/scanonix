/**
 * Generates app/favicon-source.png and app/favicon.ico.
 *
 * Phase 130L-4R6: O2 optical crop from app/icon.png → punch near-black to true alpha →
 * optical fill on transparent canvas → Lanczos3 downsample → RGBA ICO.
 * Keeps O2_CROP + Lanczos3 + ensureAlpha (no posterization / nearest final).
 *
 * Run: npm run generate:favicon
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import toIco from "to-ico";

const root = process.cwd();
const brandSourcePath = join(root, "app", "icon.png");
const faviconSourcePath = join(root, "app", "favicon-source.png");
const outputPath = join(root, "app", "favicon.ico");

/** Approved O2 optical master crop (Phase 130G-7/130G-8). Hardcoded — do not recalculate. */
export const O2_CROP = Object.freeze({ x: 129, y: 129, width: 766, height: 766 });

const ICO_SIZES = [16, 32, 48];

async function loadBrandSource() {
  if (!existsSync(brandSourcePath)) {
    throw new Error("Missing app/icon.png");
  }
  const buf = readFileSync(brandSourcePath);
  const meta = await sharp(buf).metadata();
  if (meta.width !== 1024 || meta.height !== 1024) {
    throw new Error(`Expected app/icon.png 1024×1024, got ${meta.width}×${meta.height}`);
  }
  return buf;
}

/** O2 optical master square (766×766) extracted from brand source. */
export async function extractO2Master(sourceBuf) {
  return sharp(sourceBuf)
    .extract({
      left: O2_CROP.x,
      top: O2_CROP.y,
      width: O2_CROP.width,
      height: O2_CROP.height,
    })
    .png()
    .toBuffer();
}

/**
 * Legacy fill-frame helper (tiled). Prefer generateFaviconAssets / 130L-4R6 transparent path.
 * ensureAlpha() is required: to-ico reads RGBA; RGB-only PNGs corrupt ICO BMP frames.
 */
export async function renderO2Frame(sourceBuf, size) {
  return sharp(sourceBuf)
    .extract({
      left: O2_CROP.x,
      top: O2_CROP.y,
      width: O2_CROP.width,
      height: O2_CROP.height,
    })
    .resize(size, size, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .png()
    .toBuffer();
}

/** 256×256 Lanczos preview of the O2 optical master for favicon-source.png. */
export async function buildFaviconSourcePreview(sourceBuf) {
  const master = await extractO2Master(sourceBuf);
  return sharp(master)
    .resize(256, 256, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .png()
    .toBuffer();
}

/** 130L-4R6 transparent standalone favicon + mark generation. */
export async function generateFaviconAssets({ write = true } = {}) {
  const { generateStandaloneMarkAndFavicon } = await import(
    "./generate-standalone-mark-130l4r6.mjs"
  );
  const result = await generateStandaloneMarkAndFavicon({ write });
  if (write) {
    console.log(`Generated ${faviconSourcePath} (transparent O2 mark preview)`);
    console.log(
      `Generated ${outputPath} (${result.icoBuffer.length} bytes, sizes: ${ICO_SIZES.join(", ")})`,
    );
  }
  return {
    faviconSource: result.faviconSource,
    frames: result.frames,
    icoBuffer: result.icoBuffer,
  };
}

const isMain =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  generateFaviconAssets().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
