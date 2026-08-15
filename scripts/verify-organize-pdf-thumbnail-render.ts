/**
 * Organize PDF thumbnail render plan tests (Phase 120D-FIX1).
 * Run: npx tsx scripts/verify-organize-pdf-thumbnail-render.ts
 */

import {
  clampOrganizeThumbnailDevicePixelRatio,
  computeOrganizeThumbnailRenderPlan,
  LEGACY_ORGANIZE_THUMBNAIL_EFFECTIVE_LONG_EDGE,
  ORGANIZE_THUMBNAIL_MAX_CANVAS_LONG_EDGE,
  ORGANIZE_THUMBNAIL_TARGET_CSS_LONG_EDGE,
} from "../lib/tools/organize-pdf/thumbnail-render";

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

function approxEqual(a: number, b: number, tolerance = 0.5): boolean {
  return Math.abs(a - b) <= tolerance;
}

function run() {
  console.log("\nOrganize PDF thumbnail render verification\n");

  const portraitA4 = { viewportWidth: 595, viewportHeight: 842 };

  const portraitDpr1 = computeOrganizeThumbnailRenderPlan({
    ...portraitA4,
    devicePixelRatio: 1,
  });
  assert(
    "portrait DPR 1 targets sharper long edge than legacy",
    portraitDpr1.targetLongEdge > LEGACY_ORGANIZE_THUMBNAIL_EFFECTIVE_LONG_EDGE * 3,
    `got ${portraitDpr1.targetLongEdge}`,
  );
  assert(
    "portrait DPR 1 canvas long edge",
    approxEqual(
      Math.max(portraitDpr1.canvasWidth, portraitDpr1.canvasHeight),
      ORGANIZE_THUMBNAIL_TARGET_CSS_LONG_EDGE,
    ),
  );

  const portraitDpr2 = computeOrganizeThumbnailRenderPlan({
    ...portraitA4,
    devicePixelRatio: 2,
  });
  assert("portrait DPR 2 doubles target", portraitDpr2.devicePixelRatio === 2);
  assert(
    "portrait DPR 2 canvas long edge",
    approxEqual(
      Math.max(portraitDpr2.canvasWidth, portraitDpr2.canvasHeight),
      ORGANIZE_THUMBNAIL_TARGET_CSS_LONG_EDGE * 2,
    ),
  );

  const portraitDpr3 = computeOrganizeThumbnailRenderPlan({
    ...portraitA4,
    devicePixelRatio: 3,
  });
  assert(
    "portrait DPR 3 clamped to max DPR",
    portraitDpr3.devicePixelRatio === 2,
  );

  const landscape = computeOrganizeThumbnailRenderPlan({
    viewportWidth: 842,
    viewportHeight: 595,
    devicePixelRatio: 1,
  });
  assert(
    "landscape long edge target",
    approxEqual(
      Math.max(landscape.canvasWidth, landscape.canvasHeight),
      ORGANIZE_THUMBNAIL_TARGET_CSS_LONG_EDGE,
    ),
  );

  const rotatedPortrait = computeOrganizeThumbnailRenderPlan({
    viewportWidth: 842,
    viewportHeight: 595,
    devicePixelRatio: 1,
  });
  assert(
    "90° rotated portrait uses swapped viewport dimensions",
    approxEqual(
      Math.max(rotatedPortrait.canvasWidth, rotatedPortrait.canvasHeight),
      ORGANIZE_THUMBNAIL_TARGET_CSS_LONG_EDGE,
    ),
  );

  const aspect = portraitDpr1.canvasWidth / portraitDpr1.canvasHeight;
  assert(
    "portrait aspect ratio preserved",
    approxEqual(aspect, portraitA4.viewportWidth / portraitA4.viewportHeight, 0.01),
  );

  const capped = computeOrganizeThumbnailRenderPlan({
    ...portraitA4,
    devicePixelRatio: 2,
    targetCssLongEdge: 400,
    maxCanvasLongEdge: ORGANIZE_THUMBNAIL_MAX_CANVAS_LONG_EDGE,
  });
  assert(
    "canvas long edge cap enforced",
    Math.max(capped.canvasWidth, capped.canvasHeight) <=
      ORGANIZE_THUMBNAIL_MAX_CANVAS_LONG_EDGE + 0.5,
  );

  assert(
    "DPR clamp lower bound",
    clampOrganizeThumbnailDevicePixelRatio(0) === 1,
  );
  assert(
    "DPR clamp upper bound",
    clampOrganizeThumbnailDevicePixelRatio(4) === 2,
  );

  const smallPage = computeOrganizeThumbnailRenderPlan({
    viewportWidth: 200,
    viewportHeight: 300,
    devicePixelRatio: 1,
  });
  assert(
    "small page still reaches readable target long edge",
    Math.max(smallPage.canvasWidth, smallPage.canvasHeight) >= 320,
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

run();
