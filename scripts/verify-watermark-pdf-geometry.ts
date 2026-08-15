/**
 * Geometry tests for Watermark PDF (Phase 124B).
 * Run: npx tsx scripts/verify-watermark-pdf-geometry.ts
 */

import { StandardFonts } from "pdf-lib";
import { PDFDocument } from "pdf-lib";
import {
  computeTextWatermarkAnchor,
  computeImageWatermarkAnchor,
  computeWatermarkDrawRotation,
  createWatermarkPageGeometry,
  localAnchorToPdfDrawOptions,
  validateTextFitsInVisibleBox,
  visibleLocalPointToPdf,
  type WatermarkPosition,
} from "../lib/tools/watermark-pdf";
import type { PdfBox } from "../lib/tools/crop-pdf/types";

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

function approxEqual(a: number, b: number, epsilon = 0.01): boolean {
  return Math.abs(a - b) <= epsilon;
}

function assertPoint(
  name: string,
  actual: { x: number; y: number },
  expected: { x: number; y: number },
  epsilon = 0.01,
) {
  const ok =
    approxEqual(actual.x, expected.x, epsilon) &&
    approxEqual(actual.y, expected.y, epsilon);
  assert(
    name,
    ok,
    ok
      ? ""
      : `got (${actual.x}, ${actual.y}), expected (${expected.x}, ${expected.y})`,
  );
}

function assertLocalAnchor(
  name: string,
  actual: { localX: number; localY: number },
  expected: { localX: number; localY: number },
  epsilon = 0.01,
) {
  const ok =
    approxEqual(actual.localX, expected.localX, epsilon) &&
    approxEqual(actual.localY, expected.localY, epsilon);
  assert(
    name,
    ok,
    ok
      ? ""
      : `got (${actual.localX}, ${actual.localY}), expected (${expected.localX}, ${expected.localY})`,
  );
}

const POSITIONS: WatermarkPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "center",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const ROTATIONS = [0, 90, 180, 270] as const;

const MARGIN = 36;
const TEXT_WIDTH = 30;
const FONT_SIZE = 10;

function geometryFrom(
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270,
  cropBox?: PdfBox,
  mediaOrigin?: { x: number; y: number },
) {
  const ox = mediaOrigin?.x ?? 0;
  const oy = mediaOrigin?.y ?? 0;
  const mediaBox: PdfBox = { x: ox, y: oy, width, height };
  const originalCropBox = cropBox ?? mediaBox;
  return createWatermarkPageGeometry(mediaBox, originalCropBox, rotation);
}

function expectedTextLocalAnchor(
  position: WatermarkPosition,
  visualWidth: number,
  visualHeight: number,
): { localX: number; localY: number } {
  const isTop = position.startsWith("top-");
  const isLeft = position.endsWith("-left");
  const isCenter = position.endsWith("-center") || position === "center";
  const isRight = position.endsWith("-right");

  let localX: number;
  if (isLeft) {
    localX = MARGIN;
  } else if (isCenter) {
    localX = (visualWidth - TEXT_WIDTH) / 2;
  } else if (isRight) {
    localX = visualWidth - MARGIN - TEXT_WIDTH;
  } else {
    localX = MARGIN;
  }

  let localY: number;
  if (position === "center") {
    localY = visualHeight / 2 + FONT_SIZE / 2;
  } else if (isTop) {
    localY = MARGIN + FONT_SIZE;
  } else {
    localY = visualHeight - MARGIN;
  }

  return { localX, localY };
}

function runPositionRotationMatrix(
  label: string,
  width: number,
  height: number,
  cropBox?: PdfBox,
) {
  for (const rotation of ROTATIONS) {
    const geometry = geometryFrom(width, height, rotation, cropBox);
    const { visualWidth, visualHeight } = geometry;

    for (const position of POSITIONS) {
      const anchor = computeTextWatermarkAnchor(
        geometry,
        position,
        MARGIN,
        TEXT_WIDTH,
        FONT_SIZE,
      );
      const expected = expectedTextLocalAnchor(position, visualWidth, visualHeight);
      assertLocalAnchor(
        `${label} rot ${rotation}° ${position} local anchor`,
        anchor,
        expected,
      );

      const pdfPoint = visibleLocalPointToPdf(anchor.localX, anchor.localY, geometry);
      const draw = localAnchorToPdfDrawOptions(anchor, geometry, 0, {
        r: 0.4,
        g: 0.4,
        b: 0.4,
      });

      assertPoint(
        `${label} rot ${rotation}° ${position} pdf draw point`,
        { x: draw.x, y: draw.y },
        pdfPoint,
      );

      assert(
        `${label} rot ${rotation}° ${position} upright rotate`,
        draw.rotate.angle === -rotation,
      );

      assert(
        `${label} rot ${rotation}° ${position} fits visible box`,
        validateTextFitsInVisibleBox(
          geometry,
          position,
          MARGIN,
          TEXT_WIDTH,
          FONT_SIZE,
        ),
      );
    }
  }
}

function runExactAssertions() {
  console.log("\n--- Exact numeric assertions ---\n");

  const portrait = geometryFrom(600, 800, 0);
  const brAnchor = computeTextWatermarkAnchor(
    portrait,
    "bottom-right",
    36,
    30,
    10,
  );
  assertLocalAnchor("Portrait 0° bottom-right local", brAnchor, { localX: 534, localY: 764 });
  assertPoint(
    "Portrait 0° bottom-right PDF",
    visibleLocalPointToPdf(brAnchor.localX, brAnchor.localY, portrait),
    { x: 534, y: 36 },
  );

  const tlAnchor = computeTextWatermarkAnchor(portrait, "top-left", 36, 30, 10);
  assertLocalAnchor("Portrait 0° top-left local", tlAnchor, { localX: 36, localY: 46 });
  assertPoint(
    "Portrait 0° top-left PDF",
    visibleLocalPointToPdf(tlAnchor.localX, tlAnchor.localY, portrait),
    { x: 36, y: 754 },
  );

  const bcAnchor = computeTextWatermarkAnchor(portrait, "bottom-center", 36, 30, 10);
  assertLocalAnchor("Portrait 0° bottom-center local", bcAnchor, { localX: 285, localY: 764 });

  const centerAnchor = computeTextWatermarkAnchor(portrait, "center", 36, 30, 10);
  assertLocalAnchor("Portrait 0° center local", centerAnchor, { localX: 285, localY: 405 });

  const offsetCrop: PdfBox = { x: 50, y: 75, width: 500, height: 650 };
  const offsetGeo = geometryFrom(600, 800, 0, offsetCrop);
  const offsetBr = computeTextWatermarkAnchor(offsetGeo, "bottom-right", 36, 30, 10);
  assertLocalAnchor("P0 offset CropBox bottom-right local", offsetBr, { localX: 434, localY: 614 });
  assertPoint(
    "P0 offset CropBox bottom-right PDF",
    visibleLocalPointToPdf(offsetBr.localX, offsetBr.localY, offsetGeo),
    { x: 484, y: 111 },
  );

  const offsetRot90 = geometryFrom(600, 800, 90, offsetCrop);
  const offsetRot90Br = computeTextWatermarkAnchor(
    offsetRot90,
    "bottom-right",
    36,
    30,
    10,
  );
  assertLocalAnchor(
    "P0 offset CropBox 90° bottom-right local",
    offsetRot90Br,
    { localX: 584, localY: 464 },
  );
  assertPoint(
    "P0 offset CropBox 90° bottom-right PDF",
    visibleLocalPointToPdf(offsetRot90Br.localX, offsetRot90Br.localY, offsetRot90),
    { x: 514, y: -9 },
  );

  const diagonalDraw = localAnchorToPdfDrawOptions(
    centerAnchor,
    portrait,
    -45,
    { r: 0.4, g: 0.4, b: 0.4 },
  );
  assert(
    "P0 center diagonal rotation combines page + user",
    diagonalDraw.rotate.angle === -45,
  );
}

async function runTextWidthAlignment() {
  console.log("\n--- Text width alignment ---\n");

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const shortWidth = font.widthOfTextAtSize("1", 10);
  const longWidth = font.widthOfTextAtSize("CONFIDENTIAL", 48);

  assert("CONFIDENTIAL wider than single digit", longWidth > shortWidth);

  const geometry = geometryFrom(600, 800, 0);
  const shortCenter = computeTextWatermarkAnchor(
    geometry,
    "center",
    36,
    shortWidth,
    10,
  );
  const longCenter = computeTextWatermarkAnchor(
    geometry,
    "center",
    36,
    longWidth,
    48,
  );

  assert(
    "Center shifts for wider text",
    longCenter.localX < shortCenter.localX,
  );

  const shortRight = computeTextWatermarkAnchor(
    geometry,
    "bottom-right",
    36,
    shortWidth,
    10,
  );
  const longRight = computeTextWatermarkAnchor(
    geometry,
    "bottom-right",
    36,
    longWidth,
    48,
  );

  assert(
    "Right anchor shifts for wider text",
    longRight.localX < shortRight.localX,
  );
}

function runImageAnchorMatrix() {
  console.log("\n--- Image anchor matrix ---\n");

  const geometry = geometryFrom(600, 800, 0);
  const imageWidth = 120;
  const imageHeight = 60;

  const bottomRight = computeImageWatermarkAnchor(
    geometry,
    "bottom-right",
    MARGIN,
    imageWidth,
    imageHeight,
  );
  assertLocalAnchor(
    "Image bottom-right local",
    bottomRight,
    { localX: 444, localY: 764 },
  );

  const topCenter = computeImageWatermarkAnchor(
    geometry,
    "top-center",
    MARGIN,
    imageWidth,
    imageHeight,
  );
  assertLocalAnchor(
    "Image top-center local",
    topCenter,
    { localX: 240, localY: 96 },
  );

  const center = computeImageWatermarkAnchor(
    geometry,
    "center",
    MARGIN,
    imageWidth,
    imageHeight,
  );
  assertLocalAnchor(
    "Image center local",
    center,
    { localX: 240, localY: 430 },
  );
}

function runUserRotationCompensation() {
  console.log("\n--- User rotation compensation ---\n");

  for (const rotation of ROTATIONS) {
    const geometry = geometryFrom(600, 800, rotation);
    const drawRotation = computeWatermarkDrawRotation(geometry, -45);
    assert(
      `Rot ${rotation}° + user -45° draw rotation`,
      drawRotation.angle === -rotation - 45,
    );
  }
}

async function run() {
  console.log("\nWatermark PDF geometry verification\n");

  runExactAssertions();

  console.log("\n--- Full 7×4 position matrix (portrait) ---\n");
  runPositionRotationMatrix("Portrait", 600, 800);

  console.log("\n--- Full 7×4 position matrix (landscape) ---\n");
  runPositionRotationMatrix("Landscape", 800, 600);

  console.log("\n--- Offset CropBox 7×4 matrix ---\n");
  runPositionRotationMatrix("Offset CropBox", 600, 800, {
    x: 50,
    y: 75,
    width: 500,
    height: 650,
  });

  console.log("\n--- Rotated offset CropBox 7×4 matrix (P0) ---\n");
  for (const rotation of ROTATIONS) {
    const geometry = geometryFrom(600, 800, rotation, {
      x: 50,
      y: 75,
      width: 500,
      height: 650,
    });
    for (const position of POSITIONS) {
      assert(
        `P0 offset rot ${rotation}° ${position} fits`,
        validateTextFitsInVisibleBox(
          geometry,
          position,
          MARGIN,
          TEXT_WIDTH,
          FONT_SIZE,
        ),
      );
    }
  }

  await runTextWidthAlignment();
  runImageAnchorMatrix();
  runUserRotationCompensation();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
