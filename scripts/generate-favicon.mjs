/**
 * One-shot generator: app/favicon.ico from app/icon.png (Phase 129D-FIX1).
 * Run: node scripts/generate-favicon.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import toIco from "to-ico";

const root = process.cwd();
const sourcePath = join(root, "app", "icon.png");
const outputPath = join(root, "app", "favicon.ico");
const sizes = [16, 32, 48];

const source = readFileSync(sourcePath);
const pngBuffers = await Promise.all(
  sizes.map((size) =>
    sharp(source)
      .resize(size, size, { fit: "cover", position: "centre" })
      .png()
      .toBuffer(),
  ),
);

const icoBuffer = await toIco(pngBuffers);
writeFileSync(outputPath, icoBuffer);

console.log(`Generated ${outputPath} (${icoBuffer.length} bytes, sizes: ${sizes.join(", ")})`);
