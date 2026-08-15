/**
 * UI helper tests for Watermark PDF client workspace (Phase 124C).
 * Run: npx tsx scripts/verify-watermark-pdf-ui-helpers.ts
 */

import { PDFDocument, degrees } from "pdf-lib";
import {
  buildWatermarkedPdfFilename,
  buildImageWatermarkExportOptions,
  buildTextWatermarkExportOptions,
  buildWatermarkExportOptions,
  clampCropPreviewDevicePixelRatio,
  computeImagePreviewDimensions,
  computeImagePreviewOverlayStyle,
  computeTextPreviewOverlayNormalized,
  computeTextPreviewOverlayStyle,
  createDefaultWorkspaceSettings,
  createPreviewGeometry,
  exportWatermarkedPdf,
  isTransparentPng,
  opacityEngineToPercent,
  opacityPercentToEngine,
  relativeWidthPercentToRatio,
  relativeWidthRatioToPercent,
  resetWorkspaceSettings,
  resolvePreviewWatermark,
  switchWatermarkMode,
  watermarkPdfDocument,
} from "../lib/tools/watermark-pdf";
import {
  canExportWatermarkWorkspace,
  createDefaultWorkspaceSettings as createUiDefaults,
  getPositionLabel,
  getTextValidationError,
  WATERMARK_SECURITY_COPY,
  WATERMARK_UI_PRIVACY_COPY,
  WATERMARK_POSITIONS,
} from "../lib/tools/watermark-pdf/workspace-ui";
import type { WatermarkPageEntry, WatermarkPosition } from "../lib/tools/watermark-pdf/types";

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
  overrides: Partial<WatermarkPageEntry> = {},
): WatermarkPageEntry {
  return {
    sourcePageIndex: 0,
    intrinsicRotation: 0,
    mediaBox: { x: 0, y: 0, width: 612, height: 792 },
    cropBox: { x: 0, y: 0, width: 612, height: 792 },
    visibleBox: { x: 0, y: 0, width: 612, height: 792 },
    ...overrides,
  };
}

function createTransparentPngBytes(): Uint8Array {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
    0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
    0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78,
    0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

async function createRotatedPageEntry(
  rotation: 0 | 90 | 180 | 270,
): Promise<WatermarkPageEntry> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  page.setRotation(degrees(rotation));
  await pdf.save();

  return makePageEntry({
    intrinsicRotation: rotation,
    mediaBox: { x: 0, y: 0, width: 612, height: 792 },
    cropBox: { x: 0, y: 0, width: 612, height: 792 },
    visibleBox: { x: 0, y: 0, width: 612, height: 792 },
  });
}

async function createOffsetCropEntry(): Promise<WatermarkPageEntry> {
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
  console.log("\nWatermark PDF UI helper verification (Phase 124C)\n");

  // A. text mode default
  const textDefaults = createDefaultWorkspaceSettings();
  assert("A text mode default", textDefaults.mode === "text");
  assert("A text default content", textDefaults.text === "CONFIDENTIAL");
  assert("A text default position center", textDefaults.position === "center");
  assert("A text default diagonal rotation", textDefaults.rotationDegrees === -45);

  // B. image mode
  const imageSettings = switchWatermarkMode(textDefaults, "image");
  assert("B image mode switch", imageSettings.mode === "image");
  assert("B image mode rotation reset", imageSettings.rotationDegrees === 0);

  const imageBytes = createTransparentPngBytes();
  const imageOptions = buildImageWatermarkExportOptions(imageSettings, imageBytes);
  assert("B image export options type", imageOptions.type === "image");
  assert("B image export bytes preserved", imageOptions.imageBytes === imageBytes);

  // C. type switch
  const backToText = switchWatermarkMode(imageSettings, "text");
  assert("C switch back to text", backToText.mode === "text");
  assert("C switch restores diagonal", backToText.rotationDegrees === -45);

  // D. text live preview state
  const pageEntry = makePageEntry();
  const textWidth = 120;
  const fontSize = 48;
  const margin = 36;
  const textStyle = computeTextPreviewOverlayStyle({
    pageEntry,
    position: "center",
    margin,
    fontSize,
    textWidth,
    color: "#666666",
    opacity: 0.3,
    rotationDegrees: -45,
    bold: false,
    cssHeight: 792,
  });
  assert("D text preview has left percent", textStyle.left.includes("%"));
  assert("D text preview has top percent", textStyle.top.includes("%"));
  assert("D text preview rotation transform", textStyle.transform.includes("-45"));
  assert("D text preview opacity", approxEqual(textStyle.opacity, 0.3));

  // E. image preview state
  const imageStyle = computeImagePreviewOverlayStyle({
    pageEntry,
    position: "center",
    margin,
    intrinsicWidth: 200,
    intrinsicHeight: 100,
    relativeWidthRatio: 0.2,
    opacity: 0.5,
    rotationDegrees: 0,
  });
  assert("E image preview width percent", imageStyle.width.includes("%"));
  assert("E image preview height percent", imageStyle.height.includes("%"));
  assert("E image preview opacity", approxEqual(imageStyle.opacity, 0.5));

  // F. position mapping
  for (const position of WATERMARK_POSITIONS) {
    const style = computeTextPreviewOverlayStyle({
      pageEntry,
      position,
      margin,
      fontSize: 24,
      textWidth: 60,
      color: "#000000",
      opacity: 0.4,
      rotationDegrees: 0,
      bold: false,
      cssHeight: 792,
    });
    assert(`F position mapping ${position}`, style.left.includes("%"));
    assert(`F position label ${position}`, getPositionLabel(position).length > 0);
  }

  // G. rotation mapping
  for (const rotation of [0, 45, -45, 90]) {
    const rotated = computeTextPreviewOverlayStyle({
      pageEntry,
      position: "center",
      margin,
      fontSize: 24,
      textWidth: 60,
      color: "#000000",
      opacity: 0.4,
      rotationDegrees: rotation,
      bold: false,
      cssHeight: 792,
    });
    const expectedTransform = rotation === 0 ? "none" : `rotate(${rotation}deg)`;
    assert(`G rotation mapping ${rotation}`, rotated.transform === expectedTransform);
  }

  // H. opacity mapping
  assert("H opacity percent to engine 30", approxEqual(opacityPercentToEngine(30), 0.3));
  assert("H opacity percent to engine 100", approxEqual(opacityPercentToEngine(100), 1));
  assert("H opacity engine to percent 0.3", opacityEngineToPercent(0.3) === 30);
  assert("H opacity engine to percent 1", opacityEngineToPercent(1) === 100);

  // I. color mapping
  const colored = computeTextPreviewOverlayStyle({
    pageEntry,
    position: "top-left",
    margin,
    fontSize: 24,
    textWidth: 60,
    color: "#ff6600",
    opacity: 0.4,
    rotationDegrees: 0,
    bold: false,
    cssHeight: 792,
  });
  assert("I color mapping hex", colored.color === "#ff6600");

  // J. font size mapping
  const smallFont = computeTextPreviewOverlayStyle({
    pageEntry,
    position: "center",
    margin,
    fontSize: 12,
    textWidth: 30,
    color: "#666666",
    opacity: 0.3,
    rotationDegrees: 0,
    bold: false,
    cssHeight: 396,
  });
  assert("J font size scaled half height", approxEqual(smallFont.fontSize, 6));

  // K. page range selection
  const allPagesPreview = resolvePreviewWatermark(true, "", 5, 2);
  assert("K all pages selected", allPagesPreview.isWatermarked);
  assert("K all pages count", allPagesPreview.selectedPages.length === 5);

  const customPreview = resolvePreviewWatermark(false, "1,3", 5, 1);
  assert("K custom range excluded page", !customPreview.isWatermarked);
  assert("K custom range included page", resolvePreviewWatermark(false, "1,3", 5, 0).isWatermarked);
  assert("K custom range parsed count", customPreview.selectedPages.length === 2);

  // L. excluded page preview
  const excluded = resolvePreviewWatermark(false, "2", 3, 0);
  assert("L excluded page not watermarked", !excluded.isWatermarked);
  assert("L excluded page selection", excluded.selectedPages.join(",") === "2");

  // M. source 0°
  const entry0 = makePageEntry({ intrinsicRotation: 0 });
  const geometry0 = createPreviewGeometry(entry0);
  assert("M source 0 visual width", geometry0.visualWidth === 612);
  assert("M source 0 visual height", geometry0.visualHeight === 792);

  // N. source 90°
  const entry90 = await createRotatedPageEntry(90);
  const geometry90 = createPreviewGeometry(entry90);
  assert("N source 90 swaps width", geometry90.visualWidth === 792);
  assert("N source 90 swaps height", geometry90.visualHeight === 612);

  // O. source 180°
  const entry180 = await createRotatedPageEntry(180);
  const geometry180 = createPreviewGeometry(entry180);
  assert("O source 180 width", geometry180.visualWidth === 612);
  assert("O source 180 height", geometry180.visualHeight === 792);

  // P. source 270°
  const entry270 = await createRotatedPageEntry(270);
  const geometry270 = createPreviewGeometry(entry270);
  assert("P source 270 swaps width", geometry270.visualWidth === 792);
  assert("P source 270 swaps height", geometry270.visualHeight === 612);

  // Q. CropBox preview
  const cropEntry = makePageEntry({
    mediaBox: { x: 0, y: 0, width: 800, height: 600 },
    cropBox: { x: 0, y: 0, width: 500, height: 400 },
    visibleBox: { x: 0, y: 0, width: 500, height: 400 },
  });
  const cropGeometry = createPreviewGeometry(cropEntry);
  assert("Q CropBox visual width", cropGeometry.visualWidth === 500);
  assert("Q CropBox visual height", cropGeometry.visualHeight === 400);

  // R. offset CropBox preview
  const offsetEntry = await createOffsetCropEntry();
  const offsetGeometry = createPreviewGeometry(offsetEntry);
  assert("R offset CropBox width", offsetGeometry.visualWidth === 500);
  assert("R offset CropBox height", offsetGeometry.visualHeight === 400);

  const offsetStyle = computeTextPreviewOverlayStyle({
    pageEntry: offsetEntry,
    position: "bottom-left",
    margin,
    fontSize: 24,
    textWidth: 60,
    color: "#000000",
    opacity: 0.4,
    rotationDegrees: 0,
    bold: false,
    cssHeight: 400,
  });
  assert("R offset preview anchor left", offsetStyle.left.startsWith(`${(margin / 500) * 100}`));

  // S. image aspect ratio
  const dimensions = computeImagePreviewDimensions(
    pageEntry,
    400,
    200,
    relativeWidthPercentToRatio(20),
  );
  assert(
    "S image aspect ratio preserved",
    approxEqual(dimensions.aspectRatio, 2),
    `got ${dimensions.aspectRatio}`,
  );
  assert(
    "S image width from ratio",
    approxEqual(dimensions.width, 612 * 0.2),
  );

  // T. transparent PNG state
  const transparentPng = createTransparentPngBytes();
  assert("T transparent PNG detected", isTransparentPng(transparentPng));
  assert("T opaque JPEG not transparent", !isTransparentPng(Uint8Array.from([0xff, 0xd8, 0xff])));

  // U. reset file
  const mutated = { ...createUiDefaults(), text: "CHANGED", mode: "image" as const };
  const reset = resetWorkspaceSettings();
  assert("U reset restores text default", reset.text === "CONFIDENTIAL");
  assert("U reset restores text mode", reset.mode === "text");

  // V. result filename
  assert(
    "V result filename",
    buildWatermarkedPdfFilename("report.pdf") === "report-watermarked.pdf",
  );
  assert(
    "V result filename no extension",
    buildWatermarkedPdfFilename("scan") === "scan-watermarked.pdf",
  );

  // W. privacy state
  assert(
    "W privacy copy",
    WATERMARK_UI_PRIVACY_COPY.includes("locally in your browser"),
  );
  assert(
    "W security copy",
    WATERMARK_SECURITY_COPY.includes("does not encrypt"),
  );

  // X. export calls 124B engine only
  assert(
    "X export wrapper is engine fn",
    exportWatermarkedPdf === watermarkPdfDocument,
  );

  const textExport = buildWatermarkExportOptions(createUiDefaults(), null);
  assert("X text export options from builder", textExport.type === "text");
  assert(
    "X text export uses engine fields",
    buildTextWatermarkExportOptions(createUiDefaults()).rotationDegrees === -45,
  );

  assert(
    "X can export text workspace",
    canExportWatermarkWorkspace(3, false, undefined, 3, "text", undefined, false),
  );
  assert(
    "X cannot export image without asset",
    !canExportWatermarkWorkspace(3, false, undefined, 3, "image", undefined, false),
  );
  assert(
    "X cannot export invalid text",
    !canExportWatermarkWorkspace(3, false, undefined, 3, "text", getTextValidationError(""), false),
  );

  const normalized = computeTextPreviewOverlayNormalized(
    pageEntry,
    "center",
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

  assert("DPR clamp lower bound", clampCropPreviewDevicePixelRatio(0) === 1);
  assert("DPR clamp upper bound", clampCropPreviewDevicePixelRatio(4, 2) === 2);

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
