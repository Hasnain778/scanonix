/**
 * Document-first editor integration tests for Watermark PDF client (Phase 124C-FIX1).
 * Run: npx tsx scripts/verify-watermark-pdf-fix1-editor.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildTextWatermarkExportOptions,
  buildWatermarkExportOptions,
  computeTextPreviewOverlayStyle,
  createDefaultWorkspaceSettings,
  exportWatermarkedPdf,
  measurePreviewTextWidth,
  resolvePreviewWatermark,
  watermarkPdfDocument,
} from "../lib/tools/watermark-pdf";
import type { WatermarkPageEntry } from "../lib/tools/watermark-pdf/types";

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

function sourceIncludes(source: string, pattern: string | RegExp, label: string) {
  const found =
    typeof pattern === "string" ? source.includes(pattern) : pattern.test(source);
  assert(label, found, typeof pattern === "string" ? `missing ${pattern}` : "");
}

function makePageEntry(): WatermarkPageEntry {
  return {
    sourcePageIndex: 0,
    intrinsicRotation: 0,
    mediaBox: { x: 0, y: 0, width: 612, height: 792 },
    cropBox: { x: 0, y: 0, width: 612, height: 792 },
    visibleBox: { x: 0, y: 0, width: 612, height: 792 },
  };
}

async function run() {
  console.log("\nWatermark PDF FIX1 editor verification (Phase 124C-FIX1)\n");

  const toolSource = read("components/tools/watermark-pdf-client/WatermarkPdfClientTool.tsx");
  const previewSource = read("components/tools/watermark-pdf-client/WatermarkPdfPreview.tsx");
  const positionSource = read("components/tools/watermark-pdf-client/PositionPicker.tsx");
  const prodPageSource = read("app/tools/watermark-pdf/page.tsx");

  // 1. PDF preview canvas/container
  sourceIncludes(
    previewSource,
    "data-watermark-pdf-preview-canvas",
    "1 PDF preview canvas/container renders",
  );

  // 2. Live watermark overlay
  sourceIncludes(
    previewSource,
    "data-watermark-pdf-overlay",
    "2 live watermark overlay element",
  );
  sourceIncludes(
    previewSource,
    "computeTextPreviewOverlayStyle",
    "2 overlay uses 124B geometry adapter",
  );
  sourceIncludes(
    previewSource,
    "computeImagePreviewOverlayStyle",
    "2 image overlay uses 124B geometry adapter",
  );

  // 3. Rotation control
  sourceIncludes(
    toolSource,
    "data-watermark-rotation-control",
    "3 rotation control fieldset",
  );

  // 4–7. Rotation preset buttons
  sourceIncludes(
    toolSource,
    "data-watermark-rotation={preset.value}",
    "4–7 rotation preset buttons wired to engine values",
  );
  const workspaceUiSource = read("lib/tools/watermark-pdf/workspace-ui.ts");
  for (const [index, value] of [-45, 0, 45, 90].entries()) {
    assert(
      `${index + 4} rotation ${value}° preset defined`,
      workspaceUiSource.includes(`value: ${value}`),
    );
  }

  // 8. Text/image mode selector
  sourceIncludes(
    toolSource,
    "data-watermark-mode-selector",
    "8 text/image mode selector",
  );
  sourceIncludes(toolSource, 'mode === "text" ? "TEXT" : "IMAGE"', "8 segmented TEXT | IMAGE labels");

  // 9. Page navigation
  sourceIncludes(toolSource, "data-watermark-page-nav", "9 page navigation container");
  sourceIncludes(toolSource, "data-watermark-page-prev", "9 previous page control");
  sourceIncludes(toolSource, "data-watermark-page-next", "9 next page control");
  sourceIncludes(toolSource, "Page {currentPageIndex + 1} of {pageCount}", "9 page indicator");

  // 10. Page range controls
  sourceIncludes(toolSource, "data-watermark-page-range", "10 page range fieldset");
  sourceIncludes(toolSource, "data-watermark-page-range-all", "10 all pages radio");
  sourceIncludes(toolSource, "data-watermark-page-range-custom", "10 custom pages radio");

  // 11. Position control
  sourceIncludes(positionSource, "data-watermark-position-picker", "11 visual position picker");

  // 12. Opacity control
  sourceIncludes(toolSource, "data-watermark-opacity-control", "12 opacity control");
  sourceIncludes(toolSource, "data-watermark-opacity-input", "12 opacity range input");

  // 13. Font size control
  sourceIncludes(toolSource, "data-watermark-font-size-control", "13 font size control");
  sourceIncludes(toolSource, "data-watermark-font-size-input", "13 font size input");

  // 14. Color control
  sourceIncludes(toolSource, "data-watermark-color-control", "14 color control");
  sourceIncludes(toolSource, "data-watermark-color-picker", "14 color picker");

  // 15. Explicit Download button
  sourceIncludes(
    toolSource,
    "data-watermark-download-button",
    "15 explicit Download watermarked PDF button",
  );
  sourceIncludes(
    toolSource,
    "Download watermarked PDF",
    "15 download button label",
  );

  // Document-first workspace layout
  sourceIncludes(toolSource, "data-watermark-pdf-workspace", "workspace container");
  sourceIncludes(
    toolSource,
    "lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]",
    "desktop ~70/30 preview/settings split",
  );
  sourceIncludes(toolSource, "data-watermark-pdf-preview-panel", "left preview panel");
  sourceIncludes(toolSource, "data-watermark-pdf-settings-panel", "right settings panel");
  sourceIncludes(toolSource, "Choose another PDF", "header choose another PDF");
  sourceIncludes(toolSource, "exportWatermarkedPdf", "export uses 124B engine wrapper");
  sourceIncludes(toolSource, "downloadBlob", "download after export");

  // Preview: PDF.js render, no PDF mutation
  sourceIncludes(previewSource, "loadPdfJsDocument", "preview uses PDF.js");
  sourceIncludes(previewSource, "page.render", "preview renders page canvas");
  sourceIncludes(previewSource, "renderTask?.cancel()", "preview cleans up render tasks");
  sourceIncludes(previewSource, "ResizeObserver", "preview respects container width");
  assert(
    "preview does not mutate PDF bytes",
    !previewSource.includes("watermarkPdfDocument") &&
      !previewSource.includes("exportWatermarkedPdf"),
  );

  // Excluded page banner
  sourceIncludes(
    previewSource,
    "This page will not be watermarked.",
    "excluded page banner copy",
  );

  // Production route uses accepted client workspace (Phase 124F)
  assert(
    "production /tools/watermark-pdf uses client workspace",
    (prodPageSource.includes("LazyWatermarkPdfClientTool") ||
      prodPageSource.includes("WatermarkPdfClientTool")) &&
      !prodPageSource.includes("LazyWatermarkPdfTool") &&
      !/\bWatermarkPdfTool\b/.test(prodPageSource),
  );

  // State flow: CONFIDENTIAL → center → 45° → 30% → overlay + export
  const settings = {
    ...createDefaultWorkspaceSettings(),
    text: "CONFIDENTIAL",
    position: "center" as const,
    rotationDegrees: 45,
    opacityPercent: 30,
    fontSize: 48,
    allPages: true,
  };

  const pageEntry = makePageEntry();
  const textWidth = measurePreviewTextWidth(settings.text, settings.fontSize, false);
  const overlay = computeTextPreviewOverlayStyle({
    pageEntry,
    position: settings.position,
    margin: settings.margin,
    fontSize: settings.fontSize,
    textWidth,
    color: settings.color,
    opacity: settings.opacityPercent / 100,
    rotationDegrees: settings.rotationDegrees,
    bold: false,
    cssHeight: 792,
  });

  assert("state flow text CONFIDENTIAL", settings.text === "CONFIDENTIAL");
  assert("state flow position center", settings.position === "center");
  assert("state flow rotation 45°", settings.rotationDegrees === 45);
  assert("state flow opacity 30%", settings.opacityPercent === 30);
  assert("state flow overlay rotation", overlay.transform.includes("45"));
  assert("state flow overlay opacity", overlay.opacity === 0.3);

  const previewState = resolvePreviewWatermark(true, "", 3, 0);
  assert("state flow all pages watermarked", previewState.isWatermarked);

  const exportOptions = buildWatermarkExportOptions(settings, null);
  assert("state flow export type text", exportOptions.type === "text");
  if (exportOptions.type === "text") {
    assert("state flow export text", exportOptions.text === "CONFIDENTIAL");
    assert("state flow export rotation", exportOptions.rotationDegrees === 45);
    assert("state flow export opacity", exportOptions.opacity === 0.3);
    assert("state flow export position", exportOptions.position === "center");
    assert("state flow export font size", exportOptions.fontSize === 48);
  }

  assert(
    "state flow export wrapper is engine",
    exportWatermarkedPdf === watermarkPdfDocument,
  );

  const built = buildTextWatermarkExportOptions(settings);
  assert("state flow builder rotation", built.rotationDegrees === 45);

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
