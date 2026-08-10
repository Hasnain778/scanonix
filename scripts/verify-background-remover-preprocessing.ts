/**
 * Automated tests for background remover preprocessing (Phase 7C).
 * Run: npx tsx scripts/verify-background-remover-preprocessing.ts
 */

import sharp from "sharp";
import {
  canAcceptBackgroundRemoverFile,
  getBackgroundRemoverFileError,
  MAX_BACKGROUND_REMOVER_BYTES,
} from "../lib/tools/background-remover/file-validation";
import { prepareProcessingInput } from "../lib/tools/background-remover/prepare-processing-input";
import {
  FREE_PROCESSING_MAX_LONG_EDGE,
  PRO_PROCESSING_MAX_LONG_EDGE,
} from "../lib/tools/background-remover/processing-limits";

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

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 80, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

function aspectRatio(width: number, height: number): number {
  return width / height;
}

async function run() {
  console.log("\nBackground remover preprocessing verification\n");

  const small = await makePng(2000, 1500);
  const smallPrepared = await prepareProcessingInput(
    small,
    "image/png",
    PRO_PROCESSING_MAX_LONG_EDGE,
  );
  assert("normal image under 4096px — not optimized", !smallPrepared.wasOptimized);
  assert(
    "normal image — dimensions unchanged",
    smallPrepared.processedWidth === 2000 && smallPrepared.processedHeight === 1500,
  );

  const edge = await makePng(4096, 3072);
  const edgeFree = await prepareProcessingInput(
    edge,
    "image/png",
    FREE_PROCESSING_MAX_LONG_EDGE,
  );
  assert("4096px image — free tier optimized", edgeFree.wasOptimized);
  assert(
    "4096px image — free long edge capped at 1920",
    Math.max(edgeFree.processedWidth, edgeFree.processedHeight) === FREE_PROCESSING_MAX_LONG_EDGE,
  );

  const edgePro = await prepareProcessingInput(
    edge,
    "image/png",
    PRO_PROCESSING_MAX_LONG_EDGE,
  );
  assert("4096px image — pro tier optimized to 3840", edgePro.wasOptimized);
  assert(
    "4096px image — pro long edge capped at 3840",
    Math.max(edgePro.processedWidth, edgePro.processedHeight) === PRO_PROCESSING_MAX_LONG_EDGE,
  );

  const large = await makePng(8064, 6048);
  const largePro = await prepareProcessingInput(
    large,
    "image/png",
    PRO_PROCESSING_MAX_LONG_EDGE,
  );
  assert("8064×6048 phone photo — optimized", largePro.wasOptimized);
  assert(
    "8064×6048 — pro long edge capped",
    Math.max(largePro.processedWidth, largePro.processedHeight) === PRO_PROCESSING_MAX_LONG_EDGE,
  );

  const portrait = await makePng(4500, 8000);
  const portraitPrepared = await prepareProcessingInput(
    portrait,
    "image/png",
    PRO_PROCESSING_MAX_LONG_EDGE,
  );
  const portraitRatio = aspectRatio(portraitPrepared.originalWidth, portraitPrepared.originalHeight);
  const portraitOutRatio = aspectRatio(
    portraitPrepared.processedWidth,
    portraitPrepared.processedHeight,
  );
  assert(
    "portrait high-res — aspect ratio preserved",
    Math.abs(portraitRatio - portraitOutRatio) < 0.02,
    `${portraitRatio.toFixed(4)} vs ${portraitOutRatio.toFixed(4)}`,
  );

  const landscape = await makePng(8000, 4500);
  const landscapePrepared = await prepareProcessingInput(
    landscape,
    "image/png",
    PRO_PROCESSING_MAX_LONG_EDGE,
  );
  const landscapeRatio = aspectRatio(
    landscapePrepared.originalWidth,
    landscapePrepared.originalHeight,
  );
  const landscapeOutRatio = aspectRatio(
    landscapePrepared.processedWidth,
    landscapePrepared.processedHeight,
  );
  assert(
    "landscape high-res — aspect ratio preserved",
    Math.abs(landscapeRatio - landscapeOutRatio) < 0.02,
  );

  const tiny = await makePng(800, 600);
  const tinyPrepared = await prepareProcessingInput(
    tiny,
    "image/png",
    FREE_PROCESSING_MAX_LONG_EDGE,
  );
  assert("small image — never upscaled", !tinyPrepared.wasOptimized);
  assert(
    "small image — dimensions unchanged",
    tinyPrepared.processedWidth === 800 && tinyPrepared.processedHeight === 600,
  );

  const preparedPng = await prepareProcessingInput(
    largePro.buffer,
    "image/png",
    PRO_PROCESSING_MAX_LONG_EDGE,
  );
  const meta = await sharp(preparedPng.buffer).metadata();
  assert("optimized output — valid PNG buffer", (meta.width ?? 0) > 0);

  const fakeFile = {
    name: "test.txt",
    type: "text/plain",
    size: 1024,
  } as File;
  assert("invalid type rejected", getBackgroundRemoverFileError(fakeFile) !== null);
  assert("invalid type not accepted", !canAcceptBackgroundRemoverFile(fakeFile));

  const bigFile = {
    name: "big.jpg",
    type: "image/jpeg",
    size: MAX_BACKGROUND_REMOVER_BYTES + 1,
  } as File;
  assert("oversized file rejected", getBackgroundRemoverFileError(bigFile) !== null);

  const validFile = {
    name: "photo.jpg",
    type: "image/jpeg",
    size: 1024,
  } as File;
  assert("valid file accepted", canAcceptBackgroundRemoverFile(validFile));

  let maliciousRejected = false;
  try {
    await prepareProcessingInput(
      await makePng(20_000, 20_000),
      "image/png",
      PRO_PROCESSING_MAX_LONG_EDGE,
    );
  } catch {
    maliciousRejected = true;
  }
  assert("absurd dimensions rejected server-side", maliciousRejected);

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
