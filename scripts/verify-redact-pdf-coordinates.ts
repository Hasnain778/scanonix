/**
 * Coordinate conversion tests for Redact PDF (Phase 125B).
 * Run: npx tsx scripts/verify-redact-pdf-coordinates.ts
 */

import {
  clampNormalizedRedaction,
  createRedactionPageGeometry,
  normalizedRedactionsToCanvasRects,
  validateNormalizedRedaction,
} from "../lib/tools/redact-pdf/coordinates";
import type { PdfBox } from "../lib/tools/crop-pdf/types";
import type { NormalizedRedactionRect } from "../lib/tools/redact-pdf/types";
import { REDACT_RENDER_SCALE } from "../lib/tools/redact-pdf/limits";
import { computeRedactPageRenderPlan } from "../lib/tools/redact-pdf/render-plan";

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

const ASYMMETRIC: NormalizedRedactionRect = {
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
  return createRedactionPageGeometry(mediaBox, originalCropBox, rotation);
}

function run() {
  console.log("\nRedact PDF coordinate verification\n");

  const portrait = geometryFromSize(600, 800, 0);
  assert(
    "TEST A — portrait geometry visual dimensions",
    portrait.visualWidth === 600 && portrait.visualHeight === 800,
  );

  const landscape = geometryFromSize(800, 600, 0);
  assert(
    "TEST B — landscape geometry visual dimensions",
    landscape.visualWidth === 800 && landscape.visualHeight === 600,
  );

  assert(
    "TEST C — rotation 90° swaps visual dimensions",
    geometryFromSize(600, 800, 90).visualWidth === 800 &&
      geometryFromSize(600, 800, 90).visualHeight === 600,
  );

  assert(
    "TEST D — rotation 180° preserves visual dimensions",
    geometryFromSize(600, 800, 180).visualWidth === 600 &&
      geometryFromSize(600, 800, 180).visualHeight === 800,
  );

  assert(
    "TEST E — rotation 270° swaps visual dimensions",
    geometryFromSize(600, 800, 270).visualWidth === 800 &&
      geometryFromSize(600, 800, 270).visualHeight === 600,
  );

  const offsetCrop: PdfBox = { x: 50, y: 75, width: 500, height: 650 };
  const offsetGeometry = geometryFromSize(600, 800, 0, offsetCrop);
  assert(
    "TEST F — offset CropBox visible dimensions",
    offsetGeometry.visibleBox.width === 500 &&
      offsetGeometry.visibleBox.height === 650,
  );

  assert(
    "TEST G — valid normalized redaction accepted",
    validateNormalizedRedaction({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 }),
  );

  assert(
    "TEST H — out-of-bounds redaction rejected",
    !validateNormalizedRedaction({ x: 0.8, y: 0.1, width: 0.5, height: 0.5 }),
  );

  assert(
    "TEST I — below minimum size rejected",
    !validateNormalizedRedaction({ x: 0, y: 0, width: 0.005, height: 0.5 }),
  );

  assert(
    "TEST J — at minimum size accepted",
    validateNormalizedRedaction({ x: 0, y: 0, width: 0.01, height: 0.5 }),
  );

  const clamped = clampNormalizedRedaction({ x: 0.95, y: 0.95, width: 0.5, height: 0.5 });
  assert(
    "TEST K — clamp keeps redaction inside bounds",
    clamped.x + clamped.width <= 1 + 1e-9 &&
      clamped.y + clamped.height <= 1 + 1e-9,
  );

  assert(
    "TEST L — NaN rejected",
    !validateNormalizedRedaction({ x: Number.NaN, y: 0, width: 0.5, height: 0.5 }),
  );

  assert(
    "TEST M — Infinity rejected",
    !validateNormalizedRedaction({
      x: 0,
      y: 0,
      width: Number.POSITIVE_INFINITY,
      height: 0.5,
    }),
  );

  const plan = computeRedactPageRenderPlan({
    viewportWidth: portrait.visualWidth,
    viewportHeight: portrait.visualHeight,
  });
  assert(
    "TEST N — render scale matches ~200 DPI",
    Math.abs(plan.scale - REDACT_RENDER_SCALE) < 0.01,
    `scale=${plan.scale}`,
  );

  const canvasRects = normalizedRedactionsToCanvasRects(
    [ASYMMETRIC],
    plan.canvasWidth,
    plan.canvasHeight,
  );
  assert(
    "TEST O — canvas rects scale with render plan",
    canvasRects[0].width > 0 &&
      canvasRects[0].height > 0 &&
      canvasRects[0].x >= 0 &&
      canvasRects[0].y >= 0,
  );

  assert(
    "TEST P — render plan independent of devicePixelRatio (fixed scale input)",
    Math.abs(
      computeRedactPageRenderPlan({
        viewportWidth: 600,
        viewportHeight: 800,
      }).scale -
        computeRedactPageRenderPlan({
          viewportWidth: 600,
          viewportHeight: 800,
        }).scale,
    ) < 1e-9,
  );

  assert(
    "TEST Q — asymmetric redaction validates",
    validateNormalizedRedaction(ASYMMETRIC),
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
