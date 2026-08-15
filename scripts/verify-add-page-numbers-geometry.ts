/**
 * Geometry tests for Add Page Numbers (Phase 122B).
 * Run: npx tsx scripts/verify-add-page-numbers-geometry.ts
 */

import { StandardFonts } from "pdf-lib";
import { PDFDocument } from "pdf-lib";
import {
  computePageNumberAnchor,
  createPageNumberGeometry,
  localAnchorToPdfDrawOptions,
  validateTextFitsInVisibleBox,
  visibleLocalPointToPdf,
  type PageNumberPosition,
} from "../lib/tools/add-page-numbers";
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

const POSITIONS: PageNumberPosition[] = [
  "top-left",
  "top-center",
  "top-right",
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
  return createPageNumberGeometry(mediaBox, originalCropBox, rotation);
}

function expectedLocalAnchor(
  position: PageNumberPosition,
  visualWidth: number,
  visualHeight: number,
): { localX: number; localY: number } {
  const isTop = position.startsWith("top-");
  const isLeft = position.endsWith("-left");
  const isCenter = position.endsWith("-center");

  let localX: number;
  if (isLeft) {
    localX = MARGIN;
  } else if (isCenter) {
    localX = (visualWidth - TEXT_WIDTH) / 2;
  } else {
    localX = visualWidth - MARGIN - TEXT_WIDTH;
  }

  const localY = isTop ? MARGIN + FONT_SIZE : visualHeight - MARGIN;
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
      const anchor = computePageNumberAnchor(
        geometry,
        position,
        MARGIN,
        TEXT_WIDTH,
        FONT_SIZE,
      );
      const expected = expectedLocalAnchor(position, visualWidth, visualHeight);
      assertLocalAnchor(
        `${label} rot ${rotation}° ${position} local anchor`,
        anchor,
        expected,
      );

      const pdfPoint = visibleLocalPointToPdf(anchor.localX, anchor.localY, geometry);
      const draw = localAnchorToPdfDrawOptions(anchor, geometry, FONT_SIZE, {
        r: 0,
        g: 0,
        b: 0,
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

  // Portrait 0° bottom-right
  const portrait = geometryFrom(600, 800, 0);
  const brAnchor = computePageNumberAnchor(
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

  // Portrait 0° top-left
  const tlAnchor = computePageNumberAnchor(portrait, "top-left", 36, 30, 10);
  assertLocalAnchor("Portrait 0° top-left local", tlAnchor, { localX: 36, localY: 46 });
  assertPoint(
    "Portrait 0° top-left PDF",
    visibleLocalPointToPdf(tlAnchor.localX, tlAnchor.localY, portrait),
    { x: 36, y: 754 },
  );

  // Portrait 0° bottom-center
  const bcAnchor = computePageNumberAnchor(portrait, "bottom-center", 36, 30, 10);
  assertLocalAnchor("Portrait 0° bottom-center local", bcAnchor, { localX: 285, localY: 764 });

  // Landscape 0° bottom-right (800×600)
  const landscape = geometryFrom(800, 600, 0);
  const landBr = computePageNumberAnchor(landscape, "bottom-right", 36, 30, 10);
  assertLocalAnchor("Landscape 0° bottom-right local", landBr, { localX: 734, localY: 564 });
  assertPoint(
    "Landscape 0° bottom-right PDF",
    visibleLocalPointToPdf(landBr.localX, landBr.localY, landscape),
    { x: 734, y: 36 },
  );

  // Offset CropBox (50,75,500,650) on 600×800 — bottom-right 0°
  const offsetCrop: PdfBox = { x: 50, y: 75, width: 500, height: 650 };
  const offsetGeo = geometryFrom(600, 800, 0, offsetCrop);
  const offsetBr = computePageNumberAnchor(offsetGeo, "bottom-right", 36, 30, 10);
  assertLocalAnchor("Offset CropBox bottom-right local", offsetBr, { localX: 434, localY: 614 });
  assertPoint(
    "Offset CropBox bottom-right PDF",
    visibleLocalPointToPdf(offsetBr.localX, offsetBr.localY, offsetGeo),
    { x: 484, y: 111 },
  );

  // 90° full page bottom-right
  const rot90 = geometryFrom(600, 800, 90);
  const rot90Br = computePageNumberAnchor(rot90, "bottom-right", 36, 30, 10);
  assertLocalAnchor("90° bottom-right local", rot90Br, { localX: 734, localY: 564 });
  assertPoint(
    "90° bottom-right PDF",
    visibleLocalPointToPdf(rot90Br.localX, rot90Br.localY, rot90),
    { x: 564, y: -134 },
  );

  // 270° top-left
  const rot270 = geometryFrom(600, 800, 270);
  const rot270Tl = computePageNumberAnchor(rot270, "top-left", 36, 30, 10);
  assertLocalAnchor("270° top-left local", rot270Tl, { localX: 36, localY: 46 });
  assertPoint(
    "270° top-left PDF",
    visibleLocalPointToPdf(rot270Tl.localX, rot270Tl.localY, rot270),
    { x: 554, y: 36 },
  );

  // Offset CropBox + 90° (P0 fixture)
  const offsetRot90 = geometryFrom(600, 800, 90, offsetCrop);
  const offsetRot90Br = computePageNumberAnchor(
    offsetRot90,
    "bottom-right",
    36,
    30,
    10,
  );
  assertLocalAnchor(
    "Offset CropBox 90° bottom-right local",
    offsetRot90Br,
    { localX: 584, localY: 464 },
  );
  assertPoint(
    "Offset CropBox 90° bottom-right PDF",
    visibleLocalPointToPdf(offsetRot90Br.localX, offsetRot90Br.localY, offsetRot90),
    { x: 514, y: -9 },
  );
}

async function runTextWidthAlignment() {
  console.log("\n--- Text width alignment ---\n");

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const shortWidth = font.widthOfTextAtSize("1", 10);
  const longWidth = font.widthOfTextAtSize("Page 99999 of 99999", 10);

  assert("TEST — long text wider than short", longWidth > shortWidth);

  const geometry = geometryFrom(600, 800, 0);
  const shortCenter = computePageNumberAnchor(
    geometry,
    "bottom-center",
    36,
    shortWidth,
    10,
  );
  const longCenter = computePageNumberAnchor(
    geometry,
    "bottom-center",
    36,
    longWidth,
    10,
  );

  assert(
    "TEST — center shifts for wider text",
    longCenter.localX < shortCenter.localX,
  );

  const shortRight = computePageNumberAnchor(
    geometry,
    "bottom-right",
    36,
    shortWidth,
    10,
  );
  const longRight = computePageNumberAnchor(
    geometry,
    "bottom-right",
    36,
    longWidth,
    10,
  );

  assert(
    "TEST — right anchor shifts for wider text",
    longRight.localX < shortRight.localX,
  );
}

function runMixedSizes() {
  console.log("\n--- Mixed page sizes ---\n");

  const sizes: Array<{ w: number; h: number; label: string }> = [
    { w: 595, h: 842, label: "A4 portrait" },
    { w: 842, h: 595, label: "A4 landscape" },
    { w: 200, h: 200, label: "small" },
    { w: 1000, h: 1400, label: "large" },
  ];

  for (const { w, h, label } of sizes) {
    const geometry = geometryFrom(w, h, 0);
    const anchor = computePageNumberAnchor(
      geometry,
      "bottom-center",
      36,
      TEXT_WIDTH,
      FONT_SIZE,
    );
    const expectedX = (geometry.visualWidth - TEXT_WIDTH) / 2;
    assertLocalAnchor(
      `${label} bottom-center local X`,
      { localX: anchor.localX, localY: 0 },
      { localX: expectedX, localY: 0 },
    );
    assert(
      `${label} bottom-center fits`,
      validateTextFitsInVisibleBox(
        geometry,
        "bottom-center",
        36,
        TEXT_WIDTH,
        FONT_SIZE,
      ),
    );
  }
}

function runMarginBehavior() {
  console.log("\n--- Margin behavior ---\n");

  const geometry = geometryFrom(600, 800, 0);

  for (const margin of [24, 36, 48]) {
    const anchor = computePageNumberAnchor(
      geometry,
      "bottom-left",
      margin,
      TEXT_WIDTH,
      FONT_SIZE,
    );
    assertLocalAnchor(
      `margin ${margin} bottom-left local`,
      anchor,
      { localX: margin, localY: 800 - margin },
    );
  }
}

async function run() {
  console.log("\nAdd Page Numbers geometry verification\n");

  runExactAssertions();

  console.log("\n--- Full 6×4 position matrix (portrait) ---\n");
  runPositionRotationMatrix("Portrait", 600, 800);

  console.log("\n--- Full 6×4 position matrix (landscape) ---\n");
  runPositionRotationMatrix("Landscape", 800, 600);

  console.log("\n--- Offset CropBox 6×4 matrix ---\n");
  runPositionRotationMatrix("Offset CropBox", 600, 800, {
    x: 50,
    y: 75,
    width: 500,
    height: 650,
  });

  console.log("\n--- Rotated offset CropBox 6×4 matrix (P0) ---\n");
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
  runMixedSizes();
  runMarginBehavior();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
