/**
 * Coordinate conversion tests for Crop PDF (Phase 121B).
 * Run: npx tsx scripts/verify-crop-pdf-coordinates.ts
 */

import {
  clampNormalizedCrop,
  createCropPageGeometry,
  normalizedCropToPdfCropBox,
  pdfCropBoxToNormalized,
  validateNormalizedCrop,
} from "../lib/tools/crop-pdf/coordinates";
import type { NormalizedCropRect, PdfBox } from "../lib/tools/crop-pdf/types";

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

function assertRect(
  name: string,
  actual: PdfBox,
  expected: PdfBox,
  epsilon = 0.01,
) {
  const ok =
    Math.abs(actual.x - expected.x) <= epsilon &&
    Math.abs(actual.y - expected.y) <= epsilon &&
    Math.abs(actual.width - expected.width) <= epsilon &&
    Math.abs(actual.height - expected.height) <= epsilon;

  assert(
    name,
    ok,
    ok
      ? ""
      : `got (${actual.x}, ${actual.y}, ${actual.width}×${actual.height}), expected (${expected.x}, ${expected.y}, ${expected.width}×${expected.height})`,
  );
}

const ASYMMETRIC: NormalizedCropRect = {
  x: 0.1,
  y: 0.2,
  width: 0.35,
  height: 0.45,
};

function geometryFromSize(
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270,
  cropBox?: PdfBox,
) {
  const mediaBox: PdfBox = { x: 0, y: 0, width, height };
  const originalCropBox = cropBox ?? mediaBox;
  return createCropPageGeometry(mediaBox, originalCropBox, rotation);
}

function run() {
  console.log("\nCrop PDF coordinate conversion verification\n");

  // TEST A — portrait 0°
  assertRect(
    "TEST A — portrait 0°",
    normalizedCropToPdfCropBox(
      { x: 0.5, y: 0.75, width: 0.25, height: 0.1 },
      geometryFromSize(600, 800, 0),
    ),
    { x: 300, y: 120, width: 150, height: 80 },
  );

  // TEST B — landscape 0°
  assertRect(
    "TEST B — landscape 0°",
    normalizedCropToPdfCropBox(
      { x: 0.1, y: 0.2, width: 0.35, height: 0.45 },
      geometryFromSize(800, 600, 0),
    ),
    { x: 80, y: 210, width: 280, height: 270 },
  );

  // TEST C — 90°
  assertRect(
    "TEST C — rotation 90°",
    normalizedCropToPdfCropBox(ASYMMETRIC, geometryFromSize(600, 800, 90)),
    { x: 120, y: 240, width: 270, height: 280 },
  );

  // TEST D — 180°
  assertRect(
    "TEST D — rotation 180°",
    normalizedCropToPdfCropBox(ASYMMETRIC, geometryFromSize(600, 800, 180)),
    { x: 330, y: 160, width: 210, height: 360 },
  );

  // TEST E — 270°
  assertRect(
    "TEST E — rotation 270°",
    normalizedCropToPdfCropBox(ASYMMETRIC, geometryFromSize(600, 800, 270)),
    { x: 210, y: 80, width: 270, height: 280 },
  );

  // TEST F — existing CropBox (same as MediaBox dimensions but explicit)
  const existingCrop: PdfBox = { x: 0, y: 0, width: 600, height: 800 };
  assertRect(
    "TEST F — existing CropBox full page",
    normalizedCropToPdfCropBox(ASYMMETRIC, geometryFromSize(600, 800, 0, existingCrop)),
    { x: 60, y: 280, width: 210, height: 360 },
  );

  // TEST G — existing CropBox with non-zero origin
  const offsetCrop: PdfBox = { x: 50, y: 75, width: 500, height: 650 };
  const offsetGeometry = geometryFromSize(600, 800, 0, offsetCrop);
  assertRect(
    "TEST G — non-zero CropBox origin",
    normalizedCropToPdfCropBox(ASYMMETRIC, offsetGeometry),
    { x: 100, y: 302.5, width: 175, height: 292.5 },
  );

  // Full visible round-trip for offset CropBox
  assertRect(
    "TEST G — full visible preserves original CropBox",
    normalizedCropToPdfCropBox(
      { x: 0, y: 0, width: 1, height: 1 },
      offsetGeometry,
    ),
    offsetCrop,
  );

  const portraitGeometry = geometryFromSize(600, 800, 0);

  // TEST H — top-left crop
  assertRect(
    "TEST H — top-left crop",
    normalizedCropToPdfCropBox(
      { x: 0, y: 0, width: 0.25, height: 0.25 },
      portraitGeometry,
    ),
    { x: 0, y: 600, width: 150, height: 200 },
  );

  // TEST I — top-right crop
  assertRect(
    "TEST I — top-right crop",
    normalizedCropToPdfCropBox(
      { x: 0.75, y: 0, width: 0.25, height: 0.25 },
      portraitGeometry,
    ),
    { x: 450, y: 600, width: 150, height: 200 },
  );

  // TEST J — bottom-left crop
  assertRect(
    "TEST J — bottom-left crop",
    normalizedCropToPdfCropBox(
      { x: 0, y: 0.75, width: 0.25, height: 0.25 },
      portraitGeometry,
    ),
    { x: 0, y: 0, width: 150, height: 200 },
  );

  // TEST K — bottom-right crop
  assertRect(
    "TEST K — bottom-right crop",
    normalizedCropToPdfCropBox(
      { x: 0.75, y: 0.75, width: 0.25, height: 0.25 },
      portraitGeometry,
    ),
    { x: 450, y: 0, width: 150, height: 200 },
  );

  // TEST L — asymmetric crop (portrait 0°)
  assertRect(
    "TEST L — asymmetric crop",
    normalizedCropToPdfCropBox(ASYMMETRIC, portraitGeometry),
    { x: 60, y: 280, width: 210, height: 360 },
  );

  // TEST M — preview scale independence (normalized only)
  const normalized = { x: 0.5, y: 0.75, width: 0.25, height: 0.1 };
  const expectedPortrait = { x: 300, y: 120, width: 150, height: 80 };
  assertRect(
    "TEST M — scale independence (same normalized input)",
    normalizedCropToPdfCropBox(normalized, portraitGeometry),
    expectedPortrait,
  );

  // TEST N — normalized validation
  assert(
    "TEST N — valid normalized crop accepted",
    validateNormalizedCrop({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 }),
  );
  assert(
    "TEST N — out-of-bounds rejected",
    !validateNormalizedCrop({ x: 0.8, y: 0.1, width: 0.5, height: 0.5 }),
  );

  // TEST O — crop minimum
  assert(
    "TEST O — below minimum rejected",
    !validateNormalizedCrop({ x: 0, y: 0, width: 0.01, height: 0.5 }),
  );
  assert(
    "TEST O — at minimum accepted",
    validateNormalizedCrop({ x: 0, y: 0, width: 0.02, height: 0.5 }),
  );

  // TEST P — crop bounds clamping
  const clamped = clampNormalizedCrop({ x: 0.95, y: 0.95, width: 0.5, height: 0.5 });
  assert(
    "TEST P — clamp keeps crop inside bounds",
    clamped.x + clamped.width <= 1 + 1e-9 &&
      clamped.y + clamped.height <= 1 + 1e-9,
  );

  // TEST Q — NaN/Infinity rejection
  assert(
    "TEST Q — NaN rejected",
    !validateNormalizedCrop({ x: Number.NaN, y: 0, width: 0.5, height: 0.5 }),
  );
  assert(
    "TEST Q — Infinity rejected",
    !validateNormalizedCrop({
      x: 0,
      y: 0,
      width: Number.POSITIVE_INFINITY,
      height: 0.5,
    }),
  );

  // Round-trip inverse
  const roundTrip = pdfCropBoxToNormalized(
    { x: 100, y: 302.5, width: 175, height: 292.5 },
    offsetGeometry,
  );
  assert(
    "Round-trip — pdfCropBoxToNormalized inverse",
    Math.abs(roundTrip.x - ASYMMETRIC.x) < 0.001 &&
      Math.abs(roundTrip.y - ASYMMETRIC.y) < 0.001 &&
      Math.abs(roundTrip.width - ASYMMETRIC.width) < 0.001 &&
      Math.abs(roundTrip.height - ASYMMETRIC.height) < 0.001,
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
