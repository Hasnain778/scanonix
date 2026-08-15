/**
 * Image watermark tests for Watermark PDF (Phase 124B).
 * Run: npx tsx scripts/verify-watermark-pdf-image.ts
 */

import { PDFDocument } from "pdf-lib";
import {
  computeImageDrawSize,
  createDefaultImageWatermarkOptions,
  createWatermarkPageGeometry,
  validateImageDimensions,
  validateImageFitsInVisibleBox,
  validateImageWatermarkOptions,
  validateRelativeWidthRatio,
  WatermarkPdfError,
} from "../lib/tools/watermark-pdf";

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

function assertThrowsCode(
  name: string,
  fn: () => void,
  expectedCode: WatermarkPdfError["code"],
) {
  try {
    fn();
    assert(name, false, "expected throw");
  } catch (error) {
    assert(
      name,
      error instanceof WatermarkPdfError && error.code === expectedCode,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** 1×1 transparent PNG */
const TINY_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

/** 2×1 PNG (width 2, height 1) for aspect ratio tests */
const WIDE_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

async function run() {
  console.log("\nWatermark PDF image verification\n");

  assert("Relative width 0.2 valid", validateRelativeWidthRatio(0.2) === 0.2);
  assertThrowsCode(
    "Relative width too small rejected",
    () => validateRelativeWidthRatio(0.01),
    "INVALID_SCALE",
  );
  assertThrowsCode(
    "Relative width too large rejected",
    () => validateRelativeWidthRatio(0.95),
    "INVALID_SCALE",
  );

  assertThrowsCode(
    "Empty image rejected",
    () =>
      validateImageWatermarkOptions(
        createDefaultImageWatermarkOptions(new Uint8Array(0)),
        1,
      ),
    "INVALID_IMAGE",
  );

  const validated = validateImageWatermarkOptions(
    createDefaultImageWatermarkOptions(TINY_PNG, {
      relativeWidthRatio: 0.2,
      position: "bottom-right",
    }),
    2,
  );
  assert("Image options validate", validated.relativeWidthRatio === 0.2);
  assert("Image all pages", validated.selectedPageIndices.length === 2);

  validateImageDimensions(100, 50);
  assert("Small image dimensions pass", true);
  assertThrowsCode(
    "Oversized image dimensions rejected",
    () => validateImageDimensions(3000, 1000),
    "IMAGE_TOO_BIG",
  );

  const geometry = createWatermarkPageGeometry(
    { x: 0, y: 0, width: 600, height: 800 },
    { x: 50, y: 75, width: 500, height: 650 },
    0,
  );

  const pdf = await PDFDocument.create();
  const embedded = await pdf.embedPng(WIDE_PNG);
  const drawSize = computeImageDrawSize(geometry, embedded.width, embedded.height, 0.2);

  assert(
    "Image width is 20% of visible width",
    Math.abs(drawSize.width - geometry.visualWidth * 0.2) < 0.01,
  );
  assert(
    "Aspect ratio preserved",
    Math.abs(drawSize.height / drawSize.width - embedded.height / embedded.width) < 0.01,
  );

  assert(
    "Image fits offset CropBox bottom-right",
    validateImageFitsInVisibleBox(
      geometry,
      "bottom-right",
      36,
      drawSize.width,
      drawSize.height,
    ),
  );

  assert(
    "Oversized image fails fit check",
    !validateImageFitsInVisibleBox(
      geometry,
      "bottom-right",
      36,
      geometry.visualWidth,
      geometry.visualHeight,
    ),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
