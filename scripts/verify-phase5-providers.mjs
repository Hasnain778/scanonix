/**
 * Phase 5 ML provider verification — rembg background removal + Real-ESRGAN NCNN Vulkan.
 * Run: npm run verify:phase5-providers
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

function loadEnvLocal() {
  const filePath = join(process.cwd(), ".env.local");
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

function ok(message) {
  console.log(`✓ ${message}`);
}

function skip(message) {
  console.log(`○ ${message}`);
}

function fail(message) {
  console.error(`\n✗ Phase 5 provider verification failed: ${message}\n`);
  process.exit(1);
}

function readEnv(key) {
  return process.env[key]?.trim() ?? "";
}

function isRembgConfigured() {
  return Boolean(readEnv("REMBG_PYTHON"));
}

function isRealEsrganConfigured() {
  return Boolean(readEnv("REALESRGAN_SERVICE_URL") || readEnv("REALESRGAN_BIN"));
}

async function loadPhase5Modules() {
  const { removeBackgroundWithRembg } = await import(
    "../lib/providers/background-removal/rembg-server-provider.ts"
  );
  const { upscaleWithRealEsrgan } = await import(
    "../lib/providers/upscale/realesrgan-provider.ts"
  );
  return { removeBackgroundWithRembg, upscaleWithRealEsrgan };
}

function testConfigStatus() {
  const rembg = isRembgConfigured();
  const realesrgan = isRealEsrganConfigured();

  console.log("\nPhase 5 provider configuration status:");
  console.log(`  rembg:         ${rembg ? readEnv("REMBG_PYTHON") : "NOT configured"}`);
  console.log(`  rembg model:   ${readEnv("REMBG_MODEL") || "isnet-general-use (default)"}`);
  console.log(
    `  Real-ESRGAN:   ${realesrgan ? readEnv("REALESRGAN_BIN") || readEnv("REALESRGAN_SERVICE_URL") : "NOT configured"}`,
  );
  console.log(
    `  ESRGAN model:  ${readEnv("REALESRGAN_MODEL") || "realesrgan-x4plus (default)"}`,
  );
  ok("Phase 5 config checks completed");
}

async function createPortraitLikeImage() {
  const width = 320;
  const height = 400;

  const background = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 170, b: 220 },
    },
  })
    .jpeg({ quality: 92 })
    .toBuffer();

  const subject = await sharp({
    create: {
      width: 140,
      height: 220,
      channels: 4,
      background: { r: 210, g: 150, b: 120, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  return sharp(background)
    .composite([{ input: subject, left: 90, top: 90 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function hasTransparency(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let transparent = 0;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 240) transparent += 1;
  }

  return transparent > info.width * info.height * 0.05;
}

async function testBackgroundRemoval() {
  if (!isRembgConfigured()) {
    skip("Background removal integration test skipped — REMBG_PYTHON not set");
    return null;
  }

  const { removeBackgroundWithRembg } = await loadPhase5Modules();
  const input = await createPortraitLikeImage();
  const inputMeta = await sharp(input).metadata();
  const inputWidth = inputMeta.width ?? 0;
  const inputHeight = inputMeta.height ?? 0;

  const result = await removeBackgroundWithRembg(input, "image/jpeg");
  assert.equal(result.provider, "rembg");
  assert.equal(result.model, readEnv("REMBG_MODEL") || "isnet-general-use");
  assert.equal(result.width, inputWidth, "width not preserved");
  assert.equal(result.height, inputHeight, "height not preserved");
  assert.equal(result.buffer.slice(0, 4).toString("hex"), "89504e47", "output is not PNG");
  assert.equal(await hasTransparency(result.buffer), true, "output lacks transparency");
  assert.equal(result.likelyNoSubject, false, "subject not detected");

  ok(
    `Background removal E2E passed (${inputWidth}×${inputHeight} → ${result.width}×${result.height}, model=${result.model})`,
  );

  return {
    inputWidth,
    inputHeight,
    outputWidth: result.width,
    outputHeight: result.height,
    model: result.model,
  };
}

async function testUpscaler() {
  if (!isRealEsrganConfigured()) {
    skip("Real-ESRGAN integration test skipped — REALESRGAN_BIN not set");
    return null;
  }

  const bin = readEnv("REALESRGAN_BIN");
  if (bin && !existsSync(bin)) {
    fail(`REALESRGAN_BIN does not exist: ${bin}`);
  }

  const { upscaleWithRealEsrgan } = await loadPhase5Modules();
  const input = await sharp({
    create: {
      width: 128,
      height: 96,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();

  const inputMeta = await sharp(input).metadata();
  const inputWidth = inputMeta.width ?? 0;
  const inputHeight = inputMeta.height ?? 0;

  const twoX = await upscaleWithRealEsrgan(input, { factor: 2 });
  assert.equal(twoX.width, inputWidth * 2, "2x width mismatch");
  assert.equal(twoX.height, inputHeight * 2, "2x height mismatch");

  const fourX = await upscaleWithRealEsrgan(input, { factor: 4 });
  assert.equal(fourX.width, inputWidth * 4, "4x width mismatch");
  assert.equal(fourX.height, inputHeight * 4, "4x height mismatch");

  ok(
    `Real-ESRGAN E2E passed (2x ${twoX.width}×${twoX.height}, 4x ${fourX.width}×${fourX.height})`,
  );

  return {
    inputWidth,
    inputHeight,
    twoXWidth: twoX.width,
    twoXHeight: twoX.height,
    fourXWidth: fourX.width,
    fourXHeight: fourX.height,
  };
}

async function main() {
  try {
    testConfigStatus();
    const rembgStats = await testBackgroundRemoval();
    const upscaleStats = await testUpscaler();

    if (rembgStats) {
      console.log("\nBackground removal stats:");
      console.log(JSON.stringify(rembgStats, null, 2));
    }
    if (upscaleStats) {
      console.log("\nUpscaler stats:");
      console.log(JSON.stringify(upscaleStats, null, 2));
    }

    console.log("\nPhase 5 provider verification passed.\n");
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

main();
