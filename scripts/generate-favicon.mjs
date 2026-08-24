/**
 * Generates app/favicon-source.png and app/favicon.ico (Phase 130G-9 / approved O2).
 *
 * Pipeline: exact O2 optical crop from app/icon.png → Lanczos3 downsample → RGBA ICO.
 * No posterization, palette reduction, nearest-neighbour final render, or geometry edits.
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
 * Render one favicon frame from app/icon.png via approved O2 crop + Lanczos3.
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

export async function generateFaviconAssets({ write = true } = {}) {
  const sourceBuf = await loadBrandSource();
  const faviconSource = await buildFaviconSourcePreview(sourceBuf);

  const frames = {};
  for (const size of ICO_SIZES) {
    frames[size] = await renderO2Frame(sourceBuf, size);
  }

  const icoBuffer = await toIco(ICO_SIZES.map((s) => frames[s]));

  if (write) {
    writeFileSync(faviconSourcePath, faviconSource);
    writeFileSync(outputPath, icoBuffer);
    console.log(`Generated ${faviconSourcePath} (256×256 O2 optical master preview)`);
    for (const size of ICO_SIZES) {
      console.log(`Frame ${size}×${size}: ${frames[size].length} bytes (Lanczos3, RGBA)`);
    }
    console.log(`Generated ${outputPath} (${icoBuffer.length} bytes, sizes: ${ICO_SIZES.join(", ")})`);
  }

  return { faviconSource, frames, icoBuffer };
}

const isMain =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  generateFaviconAssets().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
