/**
 * Fill PDF widget geometry tests (Phase 123B).
 * Run: npx tsx scripts/verify-fill-pdf-geometry.ts
 */

import { PDFDocument, degrees } from "pdf-lib";
import {
  createCropPageGeometry,
  normalizedCropToPdfCropBox,
  pdfCropBoxToNormalized,
} from "../lib/tools/crop-pdf/coordinates";
import type { NormalizedCropRect, PdfBox } from "../lib/tools/crop-pdf/types";
import {
  buildFormFieldDescriptors,
  widgetRectToNormalizedVisual,
} from "../lib/tools/fill-pdf";

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

function assertRect(
  name: string,
  actual: NormalizedCropRect,
  expected: NormalizedCropRect,
  epsilon = 0.01,
) {
  const ok =
    Math.abs(actual.x - expected.x) <= epsilon &&
    Math.abs(actual.y - expected.y) <= epsilon &&
    Math.abs(actual.width - expected.width) <= epsilon &&
    Math.abs(actual.height - expected.height) <= epsilon;

  assert(
    name,
    ok,
    ok
      ? ""
      : `got (${actual.x}, ${actual.y}, ${actual.width}×${actual.height}), expected (${expected.x}, ${expected.y}, ${expected.width}×${expected.height})`,
  );
}

const ASYMMETRIC: NormalizedCropRect = {
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
  return createCropPageGeometry(mediaBox, originalCropBox, rotation);
}

async function createFormPdfWithWidgetRect(
  pageWidth: number,
  pageHeight: number,
  widgetRect: PdfBox,
  rotation: 0 | 90 | 180 | 270,
  cropBox?: PdfBox,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([pageWidth, pageHeight]);

  if (rotation !== 0) {
    page.setRotation(degrees(rotation));
  }

  if (cropBox) {
    page.setCropBox(cropBox.x, cropBox.y, cropBox.width, cropBox.height);
  }

  const form = pdf.getForm();
  const field = form.createTextField("geometry.field");
  field.addToPage(page, {
    x: widgetRect.x,
    y: widgetRect.y,
    width: widgetRect.width,
    height: widgetRect.height,
  });

  return pdf.save();
}

function expectedNormalizedFromPdfRect(
  widgetRect: PdfBox,
  pageWidth: number,
  pageHeight: number,
  rotation: 0 | 90 | 180 | 270,
  cropBox?: PdfBox,
): NormalizedCropRect {
  const mediaBox: PdfBox = { x: 0, y: 0, width: pageWidth, height: pageHeight };
  const resolvedCropBox = cropBox ?? mediaBox;
  const geometry = createCropPageGeometry(mediaBox, resolvedCropBox, rotation);
  return pdfCropBoxToNormalized(widgetRect, geometry);
}

async function run() {
  console.log("\nFill PDF geometry verification\n");

  // Direct widget-geometry helper tests mirroring crop-pdf coordinate cases.
  assertRect(
    "TEST A — portrait 0°",
    widgetRectToNormalizedVisual(
      { x: 300, y: 120, width: 150, height: 80 },
      {
        mediaBox: { x: 0, y: 0, width: 600, height: 800 },
        cropBox: { x: 0, y: 0, width: 600, height: 800 },
        rotationDegrees: 0,
      },
    ),
    { x: 0.5, y: 0.75, width: 0.25, height: 0.1 },
  );

  assertRect(
    "TEST B — landscape 0°",
    widgetRectToNormalizedVisual(
      { x: 80, y: 210, width: 280, height: 270 },
      {
        mediaBox: { x: 0, y: 0, width: 800, height: 600 },
        cropBox: { x: 0, y: 0, width: 800, height: 600 },
        rotationDegrees: 0,
      },
    ),
    ASYMMETRIC,
  );

  assertRect(
    "TEST C — rotation 90°",
    widgetRectToNormalizedVisual(
      normalizedCropToPdfCropBox(ASYMMETRIC, geometryFromSize(600, 800, 90)),
      {
        mediaBox: { x: 0, y: 0, width: 600, height: 800 },
        cropBox: { x: 0, y: 0, width: 600, height: 800 },
        rotationDegrees: 90,
      },
    ),
    ASYMMETRIC,
  );

  assertRect(
    "TEST D — rotation 180°",
    widgetRectToNormalizedVisual(
      normalizedCropToPdfCropBox(ASYMMETRIC, geometryFromSize(600, 800, 180)),
      {
        mediaBox: { x: 0, y: 0, width: 600, height: 800 },
        cropBox: { x: 0, y: 0, width: 600, height: 800 },
        rotationDegrees: 180,
      },
    ),
    ASYMMETRIC,
  );

  assertRect(
    "TEST E — rotation 270°",
    widgetRectToNormalizedVisual(
      normalizedCropToPdfCropBox(ASYMMETRIC, geometryFromSize(600, 800, 270)),
      {
        mediaBox: { x: 0, y: 0, width: 600, height: 800 },
        cropBox: { x: 0, y: 0, width: 600, height: 800 },
        rotationDegrees: 270,
      },
    ),
    ASYMMETRIC,
  );

  const offsetCrop: PdfBox = { x: 50, y: 75, width: 500, height: 650 };
  assertRect(
    "TEST G — offset CropBox",
    widgetRectToNormalizedVisual(
      normalizedCropToPdfCropBox(ASYMMETRIC, geometryFromSize(600, 800, 0, offsetCrop)),
      {
        mediaBox: { x: 0, y: 0, width: 600, height: 800 },
        cropBox: offsetCrop,
        rotationDegrees: 0,
      },
    ),
    ASYMMETRIC,
  );

  // End-to-end descriptor geometry on generated PDFs.
  const portraitRect = normalizedCropToPdfCropBox(
    { x: 0.5, y: 0.75, width: 0.25, height: 0.1 },
    geometryFromSize(600, 800, 0),
  );
  const portraitBytes = await createFormPdfWithWidgetRect(600, 800, portraitRect, 0);
  const portraitPdf = await PDFDocument.load(portraitBytes);
  const portraitWidgets = buildFormFieldDescriptors(portraitPdf)[0]?.widgets ?? [];
  assertRect(
    "Portrait descriptor geometry",
    portraitWidgets[0]?.normalizedRect ?? { x: 0, y: 0, width: 0, height: 0 },
    { x: 0.5, y: 0.75, width: 0.25, height: 0.1 },
  );

  const landscapeRect = normalizedCropToPdfCropBox(
    ASYMMETRIC,
    geometryFromSize(800, 600, 0),
  );
  const landscapeBytes = await createFormPdfWithWidgetRect(800, 600, landscapeRect, 0);
  const landscapePdf = await PDFDocument.load(landscapeBytes);
  const landscapeWidgets = buildFormFieldDescriptors(landscapePdf)[0]?.widgets ?? [];
  assertRect(
    "Landscape descriptor geometry",
    landscapeWidgets[0]?.normalizedRect ?? { x: 0, y: 0, width: 0, height: 0 },
    ASYMMETRIC,
  );

  for (const rotation of [90, 180, 270] as const) {
    const rect = normalizedCropToPdfCropBox(ASYMMETRIC, geometryFromSize(600, 800, rotation));
    const bytes = await createFormPdfWithWidgetRect(600, 800, rect, rotation);
    const pdf = await PDFDocument.load(bytes);
    const widgets = buildFormFieldDescriptors(pdf)[0]?.widgets ?? [];
    assertRect(
      `Mixed rotation ${rotation}° descriptor geometry`,
      widgets[0]?.normalizedRect ?? { x: 0, y: 0, width: 0, height: 0 },
      ASYMMETRIC,
    );
  }

  const cropRect = normalizedCropToPdfCropBox(
    ASYMMETRIC,
    geometryFromSize(600, 800, 0, offsetCrop),
  );
  const cropBytes = await createFormPdfWithWidgetRect(600, 800, cropRect, 0, offsetCrop);
  const cropPdf = await PDFDocument.load(cropBytes);
  const cropWidgets = buildFormFieldDescriptors(cropPdf)[0]?.widgets ?? [];
  assertRect(
    "Offset CropBox descriptor geometry",
    cropWidgets[0]?.normalizedRect ?? { x: 0, y: 0, width: 0, height: 0 },
    ASYMMETRIC,
  );

  // Multi-widget radio group on two page sizes.
  const multiPdf = await PDFDocument.create();
  const pageA = multiPdf.addPage([600, 800]);
  const pageB = multiPdf.addPage([800, 600]);
  const form = multiPdf.getForm();
  const radio = form.createRadioGroup("multi.page.choice");
  radio.addOptionToPage("a", pageA, { x: 72, y: 700, width: 18, height: 18 });
  radio.addOptionToPage("b", pageB, { x: 96, y: 500, width: 18, height: 18 });
  const multiBytes = await multiPdf.save();
  const loadedMulti = await PDFDocument.load(multiBytes);
  const multiField = buildFormFieldDescriptors(loadedMulti).find(
    (field) => field.name === "multi.page.choice",
  );

  assert("Multi-widget count", (multiField?.widgets.length ?? 0) === 2);
  assert(
    "Multi-widget page indices",
    multiField?.widgets[0]?.pageIndex === 0 && multiField?.widgets[1]?.pageIndex === 1,
  );

  const pageBRect = multiField?.widgets[1]?.pdfRect;
  if (pageBRect) {
    const expected = expectedNormalizedFromPdfRect(pageBRect, 800, 600, 0);
    assertRect("Multi-widget page B normalized rect", multiField!.widgets[1]!.normalizedRect, expected);
  } else {
    assert("Multi-widget page B normalized rect", false, "missing widget rect");
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
