/**
 * UI helper tests for Add Page Numbers workspace (Phase 122C).
 * Run: npx tsx scripts/verify-add-page-numbers-ui-helpers.ts
 */

import { PDFDocument } from "pdf-lib";
import {
  buildNumberedPdfFilename,
  clampCropPreviewDevicePixelRatio,
  computeDisplayNumber,
  computePreviewOverlayNormalized,
  computePreviewOverlayStyle,
  createPreviewGeometry,
  formatPageNumber,
  getFormatPreviewExample,
  POSITION_GRID,
  resolvePreviewNumbering,
} from "../lib/tools/add-page-numbers";
import {
  canExportPageNumbersWorkspace,
  getPositionLabel,
} from "../lib/tools/add-page-numbers/workspace-ui";
import type { PageNumberPageEntry, PageNumberPosition } from "../lib/tools/add-page-numbers/types";

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

function makePageEntry(
  overrides: Partial<PageNumberPageEntry> = {},
): PageNumberPageEntry {
  return {
    sourcePageIndex: 0,
    intrinsicRotation: 0,
    mediaBox: { x: 0, y: 0, width: 612, height: 792 },
    cropBox: { x: 0, y: 0, width: 612, height: 792 },
    visibleBox: { x: 0, y: 0, width: 612, height: 792 },
    ...overrides,
  };
}

async function createOffsetCropEntry(): Promise<PageNumberPageEntry> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([800, 600]);
  page.setCropBox(100, 50, 500, 400);
  await pdf.save();

  return {
    sourcePageIndex: 0,
    intrinsicRotation: 0,
    mediaBox: { x: 0, y: 0, width: 800, height: 600 },
    cropBox: { x: 100, y: 50, width: 500, height: 400 },
    visibleBox: { x: 100, y: 50, width: 500, height: 400 },
  };
}

async function run() {
  console.log("\nAdd Page Numbers UI helper verification\n");

  assert(
    "display number mapping page 3 start 1",
    computeDisplayNumber([1, 2, 3, 4, 5], 2, 1) === 3,
  );
  assert(
    "display number mapping page 7 start 5",
    computeDisplayNumber([3, 5, 7], 6, 5) === 7,
  );

  const unselected = resolvePreviewNumbering(false, "1,3", 5, 1, 1, "number");
  assert("unselected preview page not numbered", !unselected.isNumbered);
  assert("unselected preview text null", unselected.text === null);

  const selected = resolvePreviewNumbering(true, "", 5, 0, 1, "page-number");
  assert("selected preview page numbered", selected.isNumbered);
  assert("selected preview text", selected.text === "Page 1");

  assert("format preview number", getFormatPreviewExample("number") === "1");
  assert(
    "format preview page-number",
    getFormatPreviewExample("page-number") === "Page 1",
  );
  assert(
    "format preview number-of-total",
    getFormatPreviewExample("number-of-total", 10) === "1 of 10",
  );
  assert(
    "format preview page-number-of-total",
    getFormatPreviewExample("page-number-of-total", 10) === "Page 1 of 10",
  );

  assert(
    "formatPageNumber typed formatter",
    formatPageNumber({
      displayNumber: 4,
      totalInSequence: 12,
      format: "number-of-total",
    }) === "4 of 12",
  );

  const positions = POSITION_GRID.flat();
  assert("six positions in grid", positions.length === 6);
  for (const position of positions) {
    assert(`position label ${position}`, getPositionLabel(position).includes(" "));
  }

  const pageEntry = makePageEntry();
  const textWidth = 30;
  const fontSize = 10;
  const margin = 36;
  const cssHeight = 792;

  const bottomCenter = computePreviewOverlayStyle({
    pageEntry,
    position: "bottom-center",
    margin,
    fontSize,
    textWidth,
    color: "#000000",
    cssHeight,
  });
  assert(
    "geometry to preview bottom-center left percent",
    bottomCenter.left.includes("%"),
  );
  assert(
    "geometry to preview bottom-center bottom percent",
    Boolean(bottomCenter.bottom?.includes("%")),
  );
  assert(
    "geometry to preview scaled font size",
    approxEqual(bottomCenter.fontSize, fontSize),
  );

  const topLeft = computePreviewOverlayStyle({
    pageEntry,
    position: "top-left",
    margin,
    fontSize,
    textWidth,
    color: "#ff6600",
    cssHeight: 396,
  });
  assert("geometry to preview top uses top", Boolean(topLeft.top?.includes("%")));
  assert(
    "geometry to preview half height scales font",
    approxEqual(topLeft.fontSize, fontSize * 0.5),
  );

  const normalized = computePreviewOverlayNormalized(
    pageEntry,
    "bottom-right",
    margin,
    textWidth,
    fontSize,
  );
  assert(
    "normalized anchor within unit square",
    normalized.normalized.normX >= 0 &&
      normalized.normalized.normX <= 1 &&
      normalized.normalized.normY >= 0 &&
      normalized.normalized.normY <= 1,
  );

  const rotatedEntry = makePageEntry({
    intrinsicRotation: 90,
    mediaBox: { x: 0, y: 0, width: 612, height: 792 },
    cropBox: { x: 0, y: 0, width: 612, height: 792 },
    visibleBox: { x: 0, y: 0, width: 612, height: 792 },
  });
  const rotatedGeometry = createPreviewGeometry(rotatedEntry);
  assert(
    "rotation 90 swaps visual dimensions",
    rotatedGeometry.visualWidth === 792 && rotatedGeometry.visualHeight === 612,
  );

  const offsetEntry = await createOffsetCropEntry();
  const offsetGeometry = createPreviewGeometry(offsetEntry);
  assert(
    "CropBox offset uses visible dimensions",
    offsetGeometry.visualWidth === 500 && offsetGeometry.visualHeight === 400,
  );

  const offsetStyle = computePreviewOverlayStyle({
    pageEntry: offsetEntry,
    position: "bottom-left",
    margin,
    fontSize,
    textWidth,
    color: "#000000",
    cssHeight: 400,
  });
  assert(
    "offset CropBox preview left at margin fraction",
    offsetStyle.left.startsWith(`${(margin / 500) * 100}`),
  );

  for (const position of positions as PageNumberPosition[]) {
    const style = computePreviewOverlayStyle({
      pageEntry: offsetEntry,
      position,
      margin,
      fontSize,
      textWidth,
      color: "#000000",
      cssHeight: 400,
    });
    assert(
      `offset preview ${position} has horizontal anchor`,
      style.left.includes("%"),
    );
  }

  assert("DPR clamp lower bound", clampCropPreviewDevicePixelRatio(0) === 1);
  assert("DPR clamp upper bound", clampCropPreviewDevicePixelRatio(4, 2) === 2);
  assert("DPR clamp passthrough", clampCropPreviewDevicePixelRatio(1.5, 2) === 1.5);

  assert(
    "export disabled with selection error",
    !canExportPageNumbersWorkspace(5, false, "Invalid range", 0),
  );
  assert(
    "export enabled with valid selection",
    canExportPageNumbersWorkspace(5, false, undefined, 5),
  );
  assert("export disabled while exporting", !canExportPageNumbersWorkspace(5, true, undefined, 5));

  assert(
    "filename helper",
    buildNumberedPdfFilename("report.pdf") === "report-numbered.pdf",
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
