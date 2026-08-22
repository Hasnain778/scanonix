/**
 * Generates app/favicon-source.png (tight crop) and app/favicon.ico (Phase 130C-FAV2).
 * Source: approved app/icon.png — preserves Scanonix S geometry and brand colors.
 * Run: node scripts/generate-favicon.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import toIco from "to-ico";

const root = process.cwd();
const brandSourcePath = join(root, "app", "icon.png");
const faviconSourcePath = join(root, "app", "favicon-source.png");
const outputPath = join(root, "app", "favicon.ico");
const icoSizes = [16, 32, 48];

/** Pixels that belong to the approved Scanonix mark (non-background). */
function isMarkPixel(r, g, b, a) {
  if (a < 10) return false;
  // Treat near-black canvas as padding; orange/white mark pixels are retained.
  return !(r < 20 && g < 20 && b < 20);
}

async function buildTightFaviconSource() {
  const { data, info } = await sharp(brandSourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * info.channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (!isMarkPixel(r, g, b, a)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX <= minX || maxY <= minY) {
    throw new Error("Could not detect Scanonix mark bounds in app/icon.png");
  }

  const markWidth = maxX - minX + 1;
  const markHeight = maxY - minY + 1;
  const markSize = Math.max(markWidth, markHeight);
  const padding = Math.round(markSize * 0.06);
  const squareSize = markSize + padding * 2;

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  let left = Math.round(centerX - squareSize / 2);
  let top = Math.round(centerY - squareSize / 2);
  let right = left + squareSize;
  let bottom = top + squareSize;

  if (left < 0) {
    right -= left;
    left = 0;
  }
  if (top < 0) {
    bottom -= top;
    top = 0;
  }
  if (right > info.width) {
    left -= right - info.width;
    right = info.width;
  }
  if (bottom > info.height) {
    top -= bottom - info.height;
    bottom = info.height;
  }

  left = Math.max(0, left);
  top = Math.max(0, top);
  const cropWidth = Math.min(info.width - left, right - left);
  const cropHeight = Math.min(info.height - top, bottom - top);
  const cropSize = Math.max(cropWidth, cropHeight);

  const extracted = await sharp(brandSourcePath)
    .extract({
      left,
      top,
      width: Math.min(cropSize, info.width - left),
      height: Math.min(cropSize, info.height - top),
    })
    .resize(cropSize, cropSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 1 },
      position: "centre",
    })
    .png()
    .toBuffer();

  writeFileSync(faviconSourcePath, extracted);

  const occupancy = ((markWidth * markHeight) / (cropSize * cropSize)) * 100;
  console.log(
    `Generated ${faviconSourcePath} (${cropSize}x${cropSize}, mark occupancy ~${occupancy.toFixed(1)}%)`,
  );

  return extracted;
}

const faviconSource = await buildTightFaviconSource();

const pngBuffers = await Promise.all(
  icoSizes.map((size) =>
    sharp(faviconSource)
      .resize(size, size, { fit: "fill" })
      .png()
      .toBuffer(),
  ),
);

const icoBuffer = await toIco(pngBuffers);
writeFileSync(outputPath, icoBuffer);

console.log(`Generated ${outputPath} (${icoBuffer.length} bytes, sizes: ${icoSizes.join(", ")})`);
