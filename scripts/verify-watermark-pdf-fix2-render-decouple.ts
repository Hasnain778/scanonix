/**
 * Render decoupling regression tests for Watermark PDF client (Phase 124C-FIX2).
 * Run: npx tsx scripts/verify-watermark-pdf-fix2-render-decouple.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  WatermarkPreviewRenderTracker,
  computeTextPreviewOverlayStyle,
  computeWatermarkPreviewDisplaySize,
  getWatermarkPreviewPdfRenderKey,
  measurePreviewTextWidth,
  resolveWatermarkPreviewContainerWidth,
  shouldUpdateWatermarkPreviewContainerWidth,
  WATERMARK_PREVIEW_CONTAINER_WIDTH_EPSILON,
} from "../lib/tools/watermark-pdf";
import type { WatermarkPageEntry, WatermarkPosition } from "../lib/tools/watermark-pdf/types";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

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

function makePageEntry(sourcePageIndex = 0): WatermarkPageEntry {
  return {
    sourcePageIndex,
    intrinsicRotation: 0,
    mediaBox: { x: 0, y: 0, width: 612, height: 792 },
    cropBox: { x: 0, y: 0, width: 612, height: 792 },
    visibleBox: { x: 0, y: 0, width: 612, height: 792 },
  };
}

function baseRenderDeps(containerWidth = 640) {
  return {
    pdfByteLength: 12_345,
    sourcePageIndex: 0,
    intrinsicRotation: 0,
    containerWidth,
  };
}

function overlayAt(
  position: WatermarkPosition,
  patch: Partial<{
    rotationDegrees: number;
    opacityPercent: number;
    fontSize: number;
    text: string;
  }> = {},
) {
  return {
    position,
    rotationDegrees: patch.rotationDegrees ?? -45,
    opacityPercent: patch.opacityPercent ?? 30,
    fontSize: patch.fontSize ?? 48,
    text: patch.text ?? "CONFIDENTIAL",
  };
}

function run() {
  console.log("\nWatermark PDF FIX2 render decouple verification (Phase 124C-FIX2)\n");

  const previewSource = read("components/tools/watermark-pdf-client/WatermarkPdfPreview.tsx");

  // Source-level guardrails
  assert(
    "preview computes display size outside PDF.js effect",
    previewSource.includes("computeWatermarkPreviewDisplaySize"),
  );
  assert(
    "preview uses stable container width resolver",
    previewSource.includes("resolveWatermarkPreviewContainerWidth"),
  );
  assert(
    "preview keeps image visible while re-rendering",
    previewSource.includes("pageImageUrl && !renderError") &&
      previewSource.includes("isRendering &&") &&
      !previewSource.includes("pageImageUrl && !isRendering && !renderError"),
  );
  assert(
    "preview canvas has fixed overflow-hidden dimensions",
    previewSource.includes("overflow-hidden") && previewSource.includes("height: displaySize.height"),
  );
  assert(
    "overlay styles are memoized separately from PDF render effect",
    previewSource.includes("textOverlayStyle = useMemo") &&
      previewSource.includes("imageOverlayStyle = useMemo"),
  );

  const pageEntry = makePageEntry();
  const tracker = new WatermarkPreviewRenderTracker();

  // 1. Render page once
  assert("1 initial PDF render", tracker.maybeRenderPdf(baseRenderDeps()));
  assert("1 no duplicate render same deps", !tracker.maybeRenderPdf(baseRenderDeps()));
  assert("1 render count is 1", tracker.pdfRenderCount === 1);

  // 2. Position changes do not increase PDF render count
  const positions: WatermarkPosition[] = [
    "top-left",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ];
  for (const position of positions) {
    tracker.updateOverlay(overlayAt(position));
    assert(`2 position ${position} no PDF re-render`, !tracker.maybeRenderPdf(baseRenderDeps()));
  }
  assert("2 render count still 1 after positions", tracker.pdfRenderCount === 1);
  assert("2 overlay updates recorded", tracker.overlayUpdateCount === positions.length);

  // 3. Rotation, opacity, font size, text changes do not increase PDF render count
  const settingChanges = [
    overlayAt("center", { rotationDegrees: 0 }),
    overlayAt("center", { rotationDegrees: 45 }),
    overlayAt("center", { opacityPercent: 50 }),
    overlayAt("center", { fontSize: 64 }),
    overlayAt("center", { text: "DRAFT" }),
  ];
  for (const [index, state] of settingChanges.entries()) {
    tracker.updateOverlay(state);
    assert(
      `3 setting change ${index + 1} no PDF re-render`,
      !tracker.maybeRenderPdf(baseRenderDeps()),
    );
  }
  assert("3 render count still 1", tracker.pdfRenderCount === 1);

  // 4. Overlay state updates correctly
  const text = "CONFIDENTIAL";
  const fontSize = 48;
  const textWidth = measurePreviewTextWidth(text, fontSize, false);
  const cssHeight = computeWatermarkPreviewDisplaySize(pageEntry, 640).height;
  const bottomLeft = computeTextPreviewOverlayStyle({
    pageEntry,
    position: "bottom-left",
    margin: 36,
    fontSize,
    textWidth,
    color: "#666666",
    opacity: 0.5,
    rotationDegrees: 45,
    bold: false,
    cssHeight,
  });
  const bottomCenter = computeTextPreviewOverlayStyle({
    pageEntry,
    position: "bottom-center",
    margin: 36,
    fontSize,
    textWidth,
    color: "#666666",
    opacity: 0.5,
    rotationDegrees: 45,
    bold: false,
    cssHeight,
  });
  assert("4 bottom-left overlay left anchor", bottomLeft.left.startsWith("5."));
  assert("4 bottom-center overlay centered", bottomLeft.left !== bottomCenter.left);
  assert("4 overlay rotation applied", bottomLeft.transform.includes("45"));
  assert("4 overlay opacity applied", bottomLeft.opacity === 0.5);
  tracker.updateOverlay(overlayAt("bottom-right", { rotationDegrees: 45, opacityPercent: 50 }));
  assert(
    "4 tracker overlay state updated",
    tracker.currentOverlayState?.position === "bottom-right" &&
      tracker.currentOverlayState.rotationDegrees === 45 &&
      tracker.currentOverlayState.opacityPercent === 50,
  );

  // 5. Page change triggers expected PDF render
  assert(
    "5 page 2 triggers render",
    tracker.maybeRenderPdf({ ...baseRenderDeps(), sourcePageIndex: 1 }),
  );
  assert("5 render count after page change", tracker.pdfRenderCount === 2);
  assert(
    "5 same page no extra render",
    !tracker.maybeRenderPdf({ ...baseRenderDeps(), sourcePageIndex: 1 }),
  );

  // 6. Stress test — 50 rapid watermark setting changes
  const stressTracker = new WatermarkPreviewRenderTracker();
  assert("6 stress initial render", stressTracker.maybeRenderPdf(baseRenderDeps()));
  const stressPositions: WatermarkPosition[] = [
    "top-left",
    "top-center",
    "top-right",
    "center",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ];
  for (let index = 0; index < 50; index += 1) {
    const position = stressPositions[index % stressPositions.length]!;
    stressTracker.updateOverlay(
      overlayAt(position, {
        rotationDegrees: (index * 7) % 360,
        opacityPercent: 10 + (index % 91),
        fontSize: 24 + (index % 48),
        text: index % 2 === 0 ? "CONFIDENTIAL" : "DRAFT",
      }),
    );
    stressTracker.maybeRenderPdf(baseRenderDeps());
  }
  assert("6 stress render count stays 1", stressTracker.pdfRenderCount === 1);
  assert("6 stress overlay updates 50", stressTracker.overlayUpdateCount === 50);
  assert(
    "6 stress final overlay correct",
    stressTracker.currentOverlayState?.position === "top-left" &&
      stressTracker.currentOverlayState.text === "DRAFT",
  );

  // Container width stability helpers
  assert(
    "container width epsilon defined",
    WATERMARK_PREVIEW_CONTAINER_WIDTH_EPSILON >= 1,
  );
  const stableClientWidth = 672;
  const stableContainerWidth = resolveWatermarkPreviewContainerWidth(640, stableClientWidth);
  assert(
    "sub-pixel resize ignored",
    !shouldUpdateWatermarkPreviewContainerWidth(stableContainerWidth, stableClientWidth + 0.25),
  );
  const settledWidth = resolveWatermarkPreviewContainerWidth(
    stableContainerWidth,
    stableClientWidth + 0.25,
  );
  assert("container width unchanged for noise", settledWidth === stableContainerWidth);
  const widerWidth = resolveWatermarkPreviewContainerWidth(stableContainerWidth, 760);
  assert(
    "meaningful resize accepted",
    shouldUpdateWatermarkPreviewContainerWidth(stableContainerWidth, 760),
  );
  assert("container width updates for real resize", widerWidth > stableContainerWidth);

  // Render key uniqueness for allowed triggers
  const keyA = getWatermarkPreviewPdfRenderKey(baseRenderDeps());
  const keyB = getWatermarkPreviewPdfRenderKey({
    ...baseRenderDeps(),
    sourcePageIndex: 1,
  });
  const keyC = getWatermarkPreviewPdfRenderKey({
    ...baseRenderDeps(),
    containerWidth: 720,
  });
  assert("render keys differ by page", keyA !== keyB);
  assert("render keys differ by container width", keyA !== keyC);
  assert("render keys stable for same deps", keyA === getWatermarkPreviewPdfRenderKey(baseRenderDeps()));

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
