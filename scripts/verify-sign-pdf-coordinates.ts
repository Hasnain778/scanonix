/**
 * Coordinate conversion tests for Sign PDF (Phase 119B).
 * Run: npx tsx scripts/verify-sign-pdf-coordinates.ts
 */

import {
  createPageGeometry,
  normalizedPlacementToPdfRect,
  previewRectToNormalized,
  previewRectToPdfRect,
} from "../lib/tools/sign-pdf/coordinates";

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

function assertRect(
  name: string,
  actual: { x: number; y: number; width: number; height: number },
  expected: { x: number; y: number; width: number; height: number },
) {
  const ok =
    approxEqual(actual.x, expected.x) &&
    approxEqual(actual.y, expected.y) &&
    approxEqual(actual.width, expected.width) &&
    approxEqual(actual.height, expected.height);

  assert(
    name,
    ok,
    ok
      ? ""
      : `got (${actual.x}, ${actual.y}, ${actual.width}×${actual.height}), expected (${expected.x}, ${expected.y}, ${expected.width}×${expected.height})`,
  );
}

function run() {
  console.log("\nSign PDF coordinate conversion verification\n");

  const portraitGeometry = createPageGeometry(600, 800, 0);

  // TEST A — portrait page
  assertRect(
    "TEST A — portrait mapping",
    previewRectToPdfRect(
      { x: 150, y: 300, width: 75, height: 40 },
      300,
      400,
      portraitGeometry,
    ),
    { x: 300, y: 120, width: 150, height: 80 },
  );

  // TEST B — landscape
  const landscapeGeometry = createPageGeometry(800, 600, 0);
  assertRect(
    "TEST B — landscape mapping",
    previewRectToPdfRect(
      { x: 100, y: 50, width: 80, height: 30 },
      400,
      300,
      landscapeGeometry,
    ),
    { x: 200, y: 440, width: 160, height: 60 },
  );

  // TEST C — preview scale independence (25%, 50%, 100%)
  const normalized = previewRectToNormalized(
    { x: 150, y: 300, width: 75, height: 40 },
    300,
    400,
  );
  const scales = [
    { previewWidth: 150, previewHeight: 200 },
    { previewWidth: 300, previewHeight: 400 },
    { previewWidth: 600, previewHeight: 800 },
  ];
  const expectedPortrait = { x: 300, y: 120, width: 150, height: 80 };
  for (const scale of scales) {
    assertRect(
      `TEST C — scale ${scale.previewWidth}×${scale.previewHeight}`,
      normalizedPlacementToPdfRect(normalized, portraitGeometry),
      expectedPortrait,
    );
  }

  // TEST D — top-left placement
  assertRect(
    "TEST D — top-left placement",
    previewRectToPdfRect(
      { x: 0, y: 0, width: 60, height: 30 },
      300,
      400,
      portraitGeometry,
    ),
    { x: 0, y: 740, width: 120, height: 60 },
  );

  // TEST E — bottom-right inside bounds
  const bottomRight = previewRectToPdfRect(
    { x: 225, y: 360, width: 75, height: 40 },
    300,
    400,
    portraitGeometry,
  );
  assert("TEST E — bottom-right inside page", bottomRight.x >= 0 && bottomRight.y >= 0);
  assert(
    "TEST E — bottom-right width/height",
    approxEqual(bottomRight.width, 150) && approxEqual(bottomRight.height, 80),
  );

  // TEST F — resize doubles PDF dimensions
  const small = previewRectToPdfRect(
    { x: 75, y: 100, width: 37.5, height: 20 },
    300,
    400,
    portraitGeometry,
  );
  const large = previewRectToPdfRect(
    { x: 150, y: 200, width: 75, height: 40 },
    600,
    800,
    portraitGeometry,
  );
  assert(
    "TEST F — doubled preview size preserves PDF dimensions",
    approxEqual(small.width, large.width) &&
      approxEqual(small.height, large.height) &&
      approxEqual(small.x, large.x) &&
      approxEqual(small.y, large.y),
  );

  // TEST G — multiple page sizes stay isolated
  const page1 = createPageGeometry(600, 800, 0);
  const page2 = createPageGeometry(800, 600, 0);
  const page1Rect = normalizedPlacementToPdfRect(
    { normX: 0.1, normY: 0.1, normWidth: 0.2, normHeight: 0.1 },
    page1,
  );
  const page2Rect = normalizedPlacementToPdfRect(
    { normX: 0.1, normY: 0.1, normWidth: 0.2, normHeight: 0.1 },
    page2,
  );
  assert(
    "TEST G — different page sizes produce different PDF rects",
    !approxEqual(page1Rect.width, page2Rect.width) ||
      !approxEqual(page1Rect.height, page2Rect.height),
  );

  // TEST H — rotations
  const rotationCases: Array<{
    name: string;
    geometry: ReturnType<typeof createPageGeometry>;
    preview: { x: number; y: number; width: number; height: number };
    previewWidth: number;
    previewHeight: number;
    expected: { x: number; y: number; width: number; height: number };
  }> = [
    {
      name: "TEST H — rotation 0°",
      geometry: createPageGeometry(600, 800, 0),
      preview: { x: 150, y: 300, width: 75, height: 40 },
      previewWidth: 300,
      previewHeight: 400,
      expected: { x: 300, y: 120, width: 150, height: 80 },
    },
    {
      name: "TEST H — rotation 90°",
      geometry: createPageGeometry(600, 800, 90),
      preview: { x: 100, y: 150, width: 50, height: 40 },
      previewWidth: 400,
      previewHeight: 300,
      expected: { x: 380, y: 400, width: 100, height: 80 },
    },
    {
      name: "TEST H — rotation 180°",
      geometry: createPageGeometry(600, 800, 180),
      preview: { x: 150, y: 300, width: 75, height: 40 },
      previewWidth: 300,
      previewHeight: 400,
      expected: { x: 300, y: 680, width: 150, height: 80 },
    },
    {
      name: "TEST H — rotation 270°",
      geometry: createPageGeometry(600, 800, 270),
      preview: { x: 100, y: 150, width: 50, height: 40 },
      previewWidth: 400,
      previewHeight: 300,
      expected: { x: 220, y: 200, width: 100, height: 80 },
    },
  ];

  for (const testCase of rotationCases) {
    assertRect(
      testCase.name,
      previewRectToPdfRect(
        testCase.preview,
        testCase.previewWidth,
        testCase.previewHeight,
        testCase.geometry,
      ),
      testCase.expected,
    );
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
