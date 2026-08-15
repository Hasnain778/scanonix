/**
 * Export engine tests for Watermark PDF (Phase 124B).
 * Run: npx tsx scripts/verify-watermark-pdf-export.ts
 */

import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { loadPdfDocument } from "../lib/pdf/core";
import {
  buildWatermarkedPdfFilename,
  createDefaultImageWatermarkOptions,
  createDefaultTextWatermarkOptions,
  loadWatermarkDocumentState,
  WatermarkPdfError,
  watermarkPdfDocument,
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

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

function approxEqual(a: number, b: number, epsilon = 0.5): boolean {
  return Math.abs(a - b) <= epsilon;
}

function assertBox(
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

/** 1×1 transparent PNG */
const TINY_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

async function createTextPdf(options: {
  width: number;
  height: number;
  text: string;
  rotation?: 0 | 90 | 180 | 270;
  cropBox?: { x: number; y: number; width: number; height: number };
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([options.width, options.height]);

  page.drawText(options.text, {
    x: 40,
    y: options.height - 60,
    size: 18,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });

  if (options.cropBox) {
    page.setCropBox(
      options.cropBox.x,
      options.cropBox.y,
      options.cropBox.width,
      options.cropBox.height,
    );
  }

  if ((options.rotation ?? 0) !== 0) {
    page.setRotation(degrees(options.rotation ?? 0));
  }

  return pdf.save();
}

async function createMultiPagePdf(
  specs: Array<{
    width: number;
    height: number;
    text: string;
    rotation?: 0 | 90 | 180 | 270;
    cropBox?: { x: number; y: number; width: number; height: number };
  }>,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  for (const spec of specs) {
    const page = pdf.addPage([spec.width, spec.height]);
    page.drawText(spec.text, {
      x: 30,
      y: spec.height - 50,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });

    if (spec.cropBox) {
      page.setCropBox(
        spec.cropBox.x,
        spec.cropBox.y,
        spec.cropBox.width,
        spec.cropBox.height,
      );
    }

    if ((spec.rotation ?? 0) !== 0) {
      page.setRotation(degrees(spec.rotation ?? 0));
    }
  }

  return pdf.save();
}

function readBoxes(pdf: Awaited<ReturnType<typeof loadPdfDocument>>, pageIndex: number) {
  const page = pdf.getPage(pageIndex);
  return {
    mediaBox: page.getMediaBox(),
    cropBox: page.getCropBox(),
    rotation: page.getRotation().angle,
  };
}

async function run() {
  console.log("\nWatermark PDF export verification\n");

  assert(
    "filename helper",
    buildWatermarkedPdfFilename("contract.pdf") === "contract-watermarked.pdf",
  );
  assert(
    "filename fallback",
    buildWatermarkedPdfFilename("document") === "document-watermarked.pdf",
  );

  const onePageBytes = bytesToArrayBuffer(
    await createTextPdf({
      width: 600,
      height: 800,
      text: "ORIGINAL_CONTENT_MARKER_XYZ",
    }),
  );

  const outOne = await watermarkPdfDocument(
    onePageBytes,
    createDefaultTextWatermarkOptions({
      text: "CONFIDENTIAL",
      position: "center",
      rotationDegrees: -45,
      opacity: 0.25,
    }),
    "application.pdf",
  );

  assert("P0 CONFIDENTIAL center diagonal export", outOne.bytes.byteLength > 0);
  assert(
    "P0 export filename",
    outOne.filename === "application-watermarked.pdf",
  );
  assert(
    "P0 watermark increases output size",
    outOne.bytes.byteLength > onePageBytes.byteLength,
  );

  const pdfOne = await loadPdfDocument(bytesToArrayBuffer(outOne.bytes));
  assert("1-page export reloads", pdfOne.getPageCount() === 1);

  const multiBytes = bytesToArrayBuffer(
    await createMultiPagePdf([
      { width: 600, height: 800, text: "PAGE ONE" },
      { width: 600, height: 800, text: "PAGE TWO" },
      { width: 600, height: 800, text: "PAGE THREE" },
    ]),
  );

  const outMulti = await watermarkPdfDocument(
    multiBytes,
    createDefaultTextWatermarkOptions(),
  );
  assert("Multi-page count preserved", (await loadPdfDocument(bytesToArrayBuffer(outMulti.bytes))).getPageCount() === 3);

  const outSelected = await watermarkPdfDocument(
    multiBytes,
    createDefaultTextWatermarkOptions({
      allPages: false,
      pageRangeInput: "1,3",
      position: "bottom-right",
      rotationDegrees: 0,
    }),
  );
  assert("Selected pages export succeeds", outSelected.bytes.byteLength > 0);

  const offsetCropBytes = bytesToArrayBuffer(
    await createTextPdf({
      width: 600,
      height: 800,
      text: "OFFSET_CROP_MARKER",
      cropBox: { x: 50, y: 75, width: 500, height: 650 },
    }),
  );

  const outOffsetBr = await watermarkPdfDocument(
    offsetCropBytes,
    createDefaultTextWatermarkOptions({
      text: "DRAFT",
      position: "bottom-right",
      rotationDegrees: 0,
      fontSize: 12,
      opacity: 0.5,
    }),
  );
  assert("P0 offset CropBox bottom-right export", outOffsetBr.bytes.byteLength > 0);
  assert(
    "P0 offset watermark increases output size",
    outOffsetBr.bytes.byteLength > offsetCropBytes.byteLength,
  );

  const beforeOffset = readBoxes(await loadPdfDocument(offsetCropBytes), 0);
  const afterOffset = readBoxes(await loadPdfDocument(bytesToArrayBuffer(outOffsetBr.bytes)), 0);
  assertBox("P0 offset CropBox preserved", afterOffset.cropBox, beforeOffset.cropBox);
  assertBox("P0 MediaBox preserved", afterOffset.mediaBox, beforeOffset.mediaBox);

  const offsetRotBytes = bytesToArrayBuffer(
    await createTextPdf({
      width: 600,
      height: 800,
      text: "ROT_OFFSET",
      cropBox: { x: 50, y: 75, width: 500, height: 650 },
      rotation: 90,
    }),
  );

  const outOffsetRot = await watermarkPdfDocument(
    offsetRotBytes,
    createDefaultTextWatermarkOptions({
      text: "DRAFT",
      position: "bottom-right",
      rotationDegrees: 45,
      fontSize: 12,
    }),
  );
  assert("P0 rotated offset CropBox + 45° export", outOffsetRot.bytes.byteLength > 0);
  const afterRotOffset = readBoxes(await loadPdfDocument(bytesToArrayBuffer(outOffsetRot.bytes)), 0);
  assert("P0 rotation preserved 90°", afterRotOffset.rotation === 90);

  const rot90Bytes = bytesToArrayBuffer(
    await createTextPdf({
      width: 600,
      height: 800,
      text: "ROT90",
      rotation: 90,
    }),
  );
  const beforeRot = readBoxes(await loadPdfDocument(rot90Bytes), 0);
  const outRot = await watermarkPdfDocument(
    rot90Bytes,
    createDefaultTextWatermarkOptions({ position: "bottom-right", rotationDegrees: 0 }),
  );
  const afterRot = readBoxes(await loadPdfDocument(bytesToArrayBuffer(outRot.bytes)), 0);
  assert("Rotation preserved 90°", afterRot.rotation === beforeRot.rotation);

  const mixedBytes = bytesToArrayBuffer(
    await createMultiPagePdf([
      { width: 595, height: 842, text: "A4" },
      { width: 842, height: 595, text: "LAND" },
      { width: 200, height: 200, text: "SMALL" },
      { width: 1000, height: 1400, text: "LARGE" },
    ]),
  );
  const outMixed = await watermarkPdfDocument(
    mixedBytes,
    createDefaultTextWatermarkOptions({
      position: "top-center",
      rotationDegrees: 0,
      fontSize: 12,
    }),
  );
  assert("Mixed page sizes export", outMixed.bytes.byteLength > 0);

  const outImage = await watermarkPdfDocument(
    onePageBytes,
    createDefaultImageWatermarkOptions(TINY_PNG, {
      position: "center",
      relativeWidthRatio: 0.2,
    }),
    "scan.pdf",
  );
  assert("Image watermark export", outImage.bytes.byteLength > 0);
  assert("Image export filename", outImage.filename === "scan-watermarked.pdf");

  const loaded = await loadWatermarkDocumentState(onePageBytes);
  assert("Load document state page count", loaded.pageCount === 1);
  assert("Load document visible box", loaded.pages[0].visibleBox.width === 600);

  const boldOut = await watermarkPdfDocument(
    onePageBytes,
    createDefaultTextWatermarkOptions({
      text: "BOLD",
      bold: true,
      rotationDegrees: 0,
      fontSize: 24,
    }),
  );
  assert("Bold watermark export", boldOut.bytes.byteLength > 0);

  try {
    await watermarkPdfDocument(
      onePageBytes,
      createDefaultTextWatermarkOptions({
        text: "🔒",
      }),
    );
    assert("Unsupported characters rejected on export", false);
  } catch (error) {
    assert(
      "Unsupported characters rejected on export",
      error instanceof WatermarkPdfError && error.code === "UNSUPPORTED_CHARACTERS",
    );
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
