/**
 * Phase 130L-4R6 — generate transparent standalone S mark + favicon frames.
 *
 * Source: app/icon.png (1024×1024 tiled mark) → O2 optical crop → punch near-black
 * to true alpha → trim → public/scanonix_mark.png + app/favicon.ico frames.
 *
 * Does NOT modify Android assets. Does NOT upscale tiny favicons for header use.
 *
 * Run: node scripts/generate-standalone-mark-130l4r6.mjs
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import toIco from "to-ico";
import { O2_CROP } from "./generate-favicon.mjs";

const root = process.cwd();
const brandSourcePath = join(root, "app", "icon.png");
const markOutPath = join(root, "public", "scanonix_mark.png");
const faviconSourcePath = join(root, "app", "favicon-source.png");
const faviconOutPath = join(root, "app", "favicon.ico");
const auditDir = join(root, ".tmp-130l4r6-audit");

const ICO_SIZES = [16, 32, 48];

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Punch black/charcoal tile (+ soft grey matte) to true transparency.
 * Keep warm orange facets and white bar. Soft-edge only for warm anti-alias.
 */
function punchBlackToAlpha(rgba, _width, _height) {
  const out = Buffer.from(rgba);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    const c = Math.max(r, g, b) - Math.min(r, g, b);
    const warmOrange = r > 85 && g > 18 && b < 140 && r > g && r > b && c > 22;
    const whiteish = L > 165 && c < 75;
    // Charcoal tile / pure black / low-chroma matte (includes rounded-tile grey ~L34)
    const tileMatte = c < 28 && L < 70;

    let alpha;
    if (warmOrange || whiteish) {
      alpha = 255;
    } else if (tileMatte) {
      alpha = 0;
    } else if (c < 40 && L < 95) {
      // Residual grey fringe → fully clear (do not leave semi-opaque matte)
      alpha = 0;
    } else if (warmOrange === false && r > 60 && g > 15 && b < 150 && c > 15 && L < 140) {
      // Soft warm AA fringe against former black
      alpha = Math.round(Math.max(0.35, Math.min(1, c / 50)) * 255);
    } else {
      alpha = 255;
    }

    out[i + 3] = alpha;
    if (alpha === 0) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
    }
  }
  return out;
}

function contentBounds(rgba, width, height, alphaThreshold = 12) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const a = rgba[(y * width + x) * 4 + 3];
      if (a > alphaThreshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("No opaque mark pixels found after alpha punch");
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function extractTransparentO2Master(sourceBuf) {
  const o2 = await sharp(sourceBuf)
    .extract({
      left: O2_CROP.x,
      top: O2_CROP.y,
      width: O2_CROP.width,
      height: O2_CROP.height,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const punched = punchBlackToAlpha(o2.data, o2.info.width, o2.info.height);
  const bounds = contentBounds(punched, o2.info.width, o2.info.height);

  // Modest padding for header mark (~6% of max side)
  const pad = Math.round(Math.max(bounds.width, bounds.height) * 0.06);
  const left = Math.max(0, bounds.left - pad);
  const top = Math.max(0, bounds.top - pad);
  const right = Math.min(o2.info.width, bounds.left + bounds.width + pad);
  const bottom = Math.min(o2.info.height, bounds.top + bounds.height + pad);
  const crop = {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };

  const cropped = await sharp(punched, {
    raw: { width: o2.info.width, height: o2.info.height, channels: 4 },
  })
    .extract(crop)
    .png()
    .toBuffer();

  return { cropped, bounds, crop, o2Size: { width: o2.info.width, height: o2.info.height } };
}

/** Place transparent mark on square canvas with optical fill ratio (favicons). */
async function renderOpticalFrame(markPng, size, fillRatio) {
  // Trim residual transparent padding so tiny frames maximize mark occupancy
  const { data, info } = await sharp(markPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bounds = contentBounds(data, info.width, info.height, 20);
  const trimmed = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract(bounds)
    .png()
    .toBuffer();

  const meta = await sharp(trimmed).metadata();
  const mw = meta.width;
  const mh = meta.height;
  const target = Math.round(size * fillRatio);
  const scale = Math.min(target / mw, target / mh);
  const tw = Math.max(1, Math.round(mw * scale));
  const th = Math.max(1, Math.round(mh * scale));
  const resized = await sharp(trimmed)
    .resize(tw, th, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .png()
    .toBuffer();

  const left = Math.floor((size - tw) / 2);
  const top = Math.floor((size - th) / 2);

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .ensureAlpha()
    .png()
    .toBuffer();
}

async function countTransparentRatio(pngBuf) {
  const { data, info } = await sharp(pngBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  let opaqueMark = 0;
  let nearBlackOpaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 16) {
      transparent += 1;
      continue;
    }
    opaqueMark += 1;
    const L = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const c = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
    if (L < 40 && c < 25) nearBlackOpaque += 1;
  }
  const total = info.width * info.height;
  return {
    width: info.width,
    height: info.height,
    transparentPct: (100 * transparent) / total,
    nearBlackOpaque,
    opaqueMark,
  };
}

export async function generateStandaloneMarkAndFavicon({ write = true } = {}) {
  if (!existsSync(brandSourcePath)) throw new Error("Missing app/icon.png");
  const sourceBuf = readFileSync(brandSourcePath);
  const meta = await sharp(sourceBuf).metadata();
  if (meta.width !== 1024 || meta.height !== 1024) {
    throw new Error(`Expected app/icon.png 1024×1024, got ${meta.width}×${meta.height}`);
  }

  const oldFaviconSha = existsSync(faviconOutPath)
    ? sha256(readFileSync(faviconOutPath))
    : null;

  const { cropped: markMaster, bounds, crop } = await extractTransparentO2Master(sourceBuf);

  // Header / UI mark — high-res transparent PNG (do not use tiny favicon as source)
  const markPng = await sharp(markMaster)
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  const faviconSource = await sharp(markMaster)
    .resize(256, 256, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  // Optical fill after trim — keep S legible at 16px without black tile
  const fillBySize = { 16: 0.98, 32: 0.95, 48: 0.94 };
  const frames = {};
  for (const size of ICO_SIZES) {
    frames[size] = await renderOpticalFrame(markMaster, size, fillBySize[size]);
  }
  const icoBuffer = await toIco(ICO_SIZES.map((s) => frames[s]));

  const stats = {
    mark: await countTransparentRatio(markPng),
    fav16: await countTransparentRatio(frames[16]),
    fav32: await countTransparentRatio(frames[32]),
    fav48: await countTransparentRatio(frames[48]),
    bounds,
    crop,
    oldFaviconSha,
    newFaviconSha: sha256(icoBuffer),
    markSha: sha256(markPng),
  };

  if (write) {
    mkdirSync(auditDir, { recursive: true });
    writeFileSync(markOutPath, markPng);
    writeFileSync(faviconSourcePath, faviconSource);
    writeFileSync(faviconOutPath, icoBuffer);
    writeFileSync(join(auditDir, "generation-report.json"), JSON.stringify(stats, null, 2));
    writeFileSync(join(auditDir, "mark-512.png"), markPng);
    for (const size of ICO_SIZES) {
      writeFileSync(join(auditDir, `new-favicon-${size}.png`), frames[size]);
    }
    // Old frames for compare board (from previous ICO if we saved SHA — extract from git HEAD)
    console.log(`Wrote ${markOutPath}`);
    console.log(`Wrote ${faviconSourcePath}`);
    console.log(`Wrote ${faviconOutPath} (${icoBuffer.length} bytes)`);
    console.log(JSON.stringify(stats, null, 2));
  }

  return { markPng, faviconSource, frames, icoBuffer, stats };
}

const isMain =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  generateStandaloneMarkAndFavicon().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
