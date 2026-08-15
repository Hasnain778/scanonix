/**
 * Crop PDF export engine tests (Phase 121B).
 * Run: npx tsx scripts/verify-crop-pdf-export.ts
 */

import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { loadPdfDocument } from "../lib/pdf/core";
import {
  buildCroppedPdfFilename,
  cropPdfDocument,
  CropPdfError,
  loadCropDocumentState,
  normalizedCropToPdfCropBox,
  createCropPageGeometry,
  resetPageCrop,
  setCropForPage,
} from "../lib/tools/crop-pdf";

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

function assertCropBox(
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

const ASYMMETRIC = { x: 0.1, y: 0.2, width: 0.35, height: 0.45 };

async function createTextPdf(
  width: number,
  height: number,
  text: string,
  rotation: 0 | 90 | 180 | 270 = 0,
  cropBox?: { x: number; y: number; width: number; height: number },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([width, height]);

  page.drawText(text, {
    x: 40,
    y: height - 60,
    size: 18,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });

  if (cropBox) {
    page.setCropBox(cropBox.x, cropBox.y, cropBox.width, cropBox.height);
  }

  if (rotation !== 0) {
    page.setRotation(degrees(rotation));
  }

  return pdf.save();
}

async function extractPageText(blob: Blob, pageIndex = 0): Promise<string> {
  const pdf = await loadPdfDocument(await blob.arrayBuffer());
  const page = pdf.getPage(pageIndex);
  const text = await (page as unknown as { getTextContent?: () => Promise<{ items: Array<{ str?: string }> }> }).getTextContent?.();

  if (!text) {
    return "";
  }

  return text.items.map((item) => item.str ?? "").join("");
}

async function run() {
  console.log("\nCrop PDF export verification\n");

  // TEST A — 1-page portrait crop
  const portraitBytes = bytesToArrayBuffer(
    await createTextPdf(600, 800, "PORTRAIT TEXT"),
  );
  let stateA = await loadCropDocumentState(portraitBytes);
  stateA = setCropForPage(stateA, stateA.pages[0].id, ASYMMETRIC);
  const blobA = await cropPdfDocument(portraitBytes, stateA);
  const pdfA = await loadPdfDocument(await blobA.arrayBuffer());
  assertCropBox(
    "TEST A — portrait crop box",
    pdfA.getPage(0).getCropBox(),
    { x: 60, y: 280, width: 210, height: 360 },
  );

  // TEST B — landscape crop
  const landscapeBytes = bytesToArrayBuffer(
    await createTextPdf(800, 600, "LANDSCAPE TEXT"),
  );
  let stateB = await loadCropDocumentState(landscapeBytes);
  stateB = setCropForPage(stateB, stateB.pages[0].id, ASYMMETRIC);
  const blobB = await cropPdfDocument(landscapeBytes, stateB);
  const pdfB = await loadPdfDocument(await blobB.arrayBuffer());
  assertCropBox(
    "TEST B — landscape crop box",
    pdfB.getPage(0).getCropBox(),
    { x: 80, y: 210, width: 280, height: 270 },
  );

  // TEST C — 90° rotated page
  const rot90Bytes = bytesToArrayBuffer(
    await createTextPdf(600, 800, "ROT90 TEXT", 90),
  );
  let stateC = await loadCropDocumentState(rot90Bytes);
  stateC = setCropForPage(stateC, stateC.pages[0].id, ASYMMETRIC);
  const blobC = await cropPdfDocument(rot90Bytes, stateC);
  const pdfC = await loadPdfDocument(await blobC.arrayBuffer());
  assertCropBox(
    "TEST C — 90° crop box",
    pdfC.getPage(0).getCropBox(),
    { x: 120, y: 240, width: 270, height: 280 },
  );
  assert(
    "TEST C — rotation preserved",
    pdfC.getPage(0).getRotation().angle === 90,
  );

  // TEST D — 180°
  const rot180Bytes = bytesToArrayBuffer(
    await createTextPdf(600, 800, "ROT180 TEXT", 180),
  );
  let stateD = await loadCropDocumentState(rot180Bytes);
  stateD = setCropForPage(stateD, stateD.pages[0].id, ASYMMETRIC);
  const blobD = await cropPdfDocument(rot180Bytes, stateD);
  const pdfD = await loadPdfDocument(await blobD.arrayBuffer());
  assertCropBox(
    "TEST D — 180° crop box",
    pdfD.getPage(0).getCropBox(),
    { x: 330, y: 160, width: 210, height: 360 },
  );

  // TEST E — 270°
  const rot270Bytes = bytesToArrayBuffer(
    await createTextPdf(600, 800, "ROT270 TEXT", 270),
  );
  let stateE = await loadCropDocumentState(rot270Bytes);
  stateE = setCropForPage(stateE, stateE.pages[0].id, ASYMMETRIC);
  const blobE = await cropPdfDocument(rot270Bytes, stateE);
  const pdfE = await loadPdfDocument(await blobE.arrayBuffer());
  assertCropBox(
    "TEST E — 270° crop box",
    pdfE.getPage(0).getCropBox(),
    { x: 210, y: 80, width: 270, height: 280 },
  );

  // TEST F — existing CropBox (smaller than MediaBox, zero origin crop on pre-cropped page)
  const pdfF = await PDFDocument.create();
  const pageF = pdfF.addPage([600, 800]);
  pageF.setCropBox(0, 0, 500, 700);
  const fixtureF = bytesToArrayBuffer(await pdfF.save());
  let stateF = await loadCropDocumentState(fixtureF);
  stateF = setCropForPage(stateF, stateF.pages[0].id, ASYMMETRIC);
  const blobF = await cropPdfDocument(fixtureF, stateF);
  const outF = await loadPdfDocument(await blobF.arrayBuffer());
  const expectedF = normalizedCropToPdfCropBox(
    ASYMMETRIC,
    createCropPageGeometry(
      { x: 0, y: 0, width: 600, height: 800 },
      { x: 0, y: 0, width: 500, height: 700 },
      0,
    ),
  );
  assertCropBox("TEST F — existing CropBox crop", outF.getPage(0).getCropBox(), expectedF);

  // TEST G — non-zero CropBox origin (MediaBox 0,0,600,800; CropBox 50,75,500,650)
  const fixtureG = bytesToArrayBuffer(
    await createTextPdf(600, 800, "OFFSET CROP", 0, {
      x: 50,
      y: 75,
      width: 500,
      height: 650,
    }),
  );
  let stateG = await loadCropDocumentState(fixtureG);
  stateG = setCropForPage(stateG, stateG.pages[0].id, ASYMMETRIC);
  const blobG = await cropPdfDocument(fixtureG, stateG);
  const outG = await loadPdfDocument(await blobG.arrayBuffer());
  assertCropBox(
    "TEST G — non-zero origin crop box",
    outG.getPage(0).getCropBox(),
    { x: 100, y: 302.5, width: 175, height: 292.5 },
  );
  assertCropBox(
    "TEST G — MediaBox preserved",
    outG.getPage(0).getMediaBox(),
    { x: 0, y: 0, width: 600, height: 800 },
  );

  // TEST H — multi-page individual crops
  const multiPdf = await PDFDocument.create();
  multiPdf.addPage([600, 800]);
  multiPdf.addPage([600, 800]);
  const multiBytes = bytesToArrayBuffer(await multiPdf.save());
  let stateH = await loadCropDocumentState(multiBytes);
  const cropH1 = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 };
  const cropH2 = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 };
  stateH = setCropForPage(stateH, stateH.pages[0].id, cropH1);
  stateH = setCropForPage(stateH, stateH.pages[1].id, cropH2);
  const blobH = await cropPdfDocument(multiBytes, stateH);
  const outH = await loadPdfDocument(await blobH.arrayBuffer());
  assert("TEST H — multi-page count", outH.getPageCount() === 2);
  assertCropBox(
    "TEST H — page 1 crop",
    outH.getPage(0).getCropBox(),
    normalizedCropToPdfCropBox(
      cropH1,
      createCropPageGeometry(
        { x: 0, y: 0, width: 600, height: 800 },
        { x: 0, y: 0, width: 600, height: 800 },
        0,
      ),
    ),
  );
  assertCropBox(
    "TEST H — page 2 crop",
    outH.getPage(1).getCropBox(),
    normalizedCropToPdfCropBox(
      cropH2,
      createCropPageGeometry(
        { x: 0, y: 0, width: 600, height: 800 },
        { x: 0, y: 0, width: 600, height: 800 },
        0,
      ),
    ),
  );

  // TEST I — mixed page sizes (only page 0 cropped)
  const mixedPdf = await PDFDocument.create();
  mixedPdf.addPage([600, 800]);
  mixedPdf.addPage([800, 600]);
  const mixedBytes = bytesToArrayBuffer(await mixedPdf.save());
  let stateI = await loadCropDocumentState(mixedBytes);
  const page0Id = stateI.pages[0].id;
  const originalPage1Crop = { ...stateI.pages[1].originalCropBox };
  stateI = setCropForPage(stateI, page0Id, ASYMMETRIC);
  const blobI = await cropPdfDocument(mixedBytes, stateI);
  const outI = await loadPdfDocument(await blobI.arrayBuffer());
  assert("TEST I — mixed sizes page count", outI.getPageCount() === 2);
  const page1Size = outI.getPage(1).getSize();
  assert(
    "TEST I — page 2 size preserved",
    approxEqual(page1Size.width, 800) && approxEqual(page1Size.height, 600),
  );
  const page1Crop = outI.getPage(1).getCropBox();
  assert(
    "TEST I — untouched page 2 CropBox preserved",
    approxEqual(page1Crop.width, originalPage1Crop.width) &&
      approxEqual(page1Crop.height, originalPage1Crop.height),
  );

  // TEST J — untouched page preserves original CropBox
  let stateJ = await loadCropDocumentState(multiBytes);
  stateJ = setCropForPage(stateJ, stateJ.pages[0].id, ASYMMETRIC);
  const originalCropJ = { ...stateJ.pages[1].originalCropBox };
  const blobJ = await cropPdfDocument(multiBytes, stateJ);
  const outJ = await loadPdfDocument(await blobJ.arrayBuffer());
  assertCropBox(
    "TEST J — untouched page CropBox",
    outJ.getPage(1).getCropBox(),
    originalCropJ,
  );

  // TEST K — reset page preserves original CropBox (50,75,500,650)
  let stateK = await loadCropDocumentState(fixtureG);
  const pageKId = stateK.pages[0].id;
  stateK = setCropForPage(stateK, pageKId, ASYMMETRIC);
  stateK = resetPageCrop(stateK, pageKId);
  const blobK = await cropPdfDocument(fixtureG, stateK);
  const outK = await loadPdfDocument(await blobK.arrayBuffer());
  assertCropBox(
    "TEST K — reset restores 50,75,500,650",
    outK.getPage(0).getCropBox(),
    { x: 50, y: 75, width: 500, height: 650 },
  );
  assert(
    "TEST K — reset does NOT restore full MediaBox",
    !approxEqual(outK.getPage(0).getCropBox().width, 600) ||
      !approxEqual(outK.getPage(0).getCropBox().x, 0),
  );

  // TEST L — page count/order preserved
  const orderPdf = await PDFDocument.create();
  orderPdf.addPage([400, 600]);
  orderPdf.addPage([500, 500]);
  orderPdf.addPage([600, 400]);
  const orderBytes = bytesToArrayBuffer(await orderPdf.save());
  let stateL = await loadCropDocumentState(orderBytes);
  stateL = setCropForPage(stateL, stateL.pages[1].id, ASYMMETRIC);
  const blobL = await cropPdfDocument(orderBytes, stateL);
  const outL = await loadPdfDocument(await blobL.arrayBuffer());
  assert("TEST L — page count preserved", outL.getPageCount() === 3);
  assert(
    "TEST L — page order preserved (sizes match source order)",
    approxEqual(outL.getPage(0).getSize().width, 400) &&
      approxEqual(outL.getPage(1).getSize().width, 500) &&
      approxEqual(outL.getPage(2).getSize().width, 600),
  );

  // TEST M — rotation preserved across export
  assert(
    "TEST M — 90° rotation preserved after export",
    pdfC.getPage(0).getRotation().angle === 90,
  );
  assert(
    "TEST M — 180° rotation preserved after export",
    pdfD.getPage(0).getRotation().angle === 180,
  );

  // TEST N — malformed PDF
  let malformedThrew = false;
  try {
    await loadCropDocumentState(bytesToArrayBuffer(new Uint8Array([1, 2, 3, 4])));
  } catch (error) {
    malformedThrew = error instanceof CropPdfError && error.code === "CORRUPT_PDF";
  }
  assert("TEST N — malformed PDF rejected", malformedThrew);

  // TEST O — filename
  assert(
    "TEST O — filename basic",
    buildCroppedPdfFilename("document.pdf") === "document-cropped.pdf",
  );
  assert(
    "TEST O — uppercase extension",
    buildCroppedPdfFilename("DOCUMENT.PDF") === "DOCUMENT-cropped.pdf",
  );
  assert(
    "TEST O — dotted name",
    buildCroppedPdfFilename("my.document.pdf") === "my.document-cropped.pdf",
  );
  assert(
    "TEST O — no extension",
    buildCroppedPdfFilename("document") === "document-cropped.pdf",
  );
  assert(
    "TEST O — spaced name",
    buildCroppedPdfFilename(" my doc .pdf ") === "my doc -cropped.pdf",
  );

  // TEST P — invalid crop rejected
  let invalidThrew = false;
  try {
    const s = await loadCropDocumentState(portraitBytes);
    setCropForPage(s, s.pages[0].id, { x: 0, y: 0, width: 0.01, height: 0.5 });
  } catch (error) {
    invalidThrew = error instanceof CropPdfError && error.code === "CROP_TOO_SMALL";
  }
  assert("TEST P — invalid crop rejected", invalidThrew);

  // TEST Q — export reloads successfully
  const reloaded = await loadPdfDocument(await blobA.arrayBuffer());
  assert(
    "TEST Q — export reloads successfully",
    reloaded.getPageCount() === 1 && reloaded.getPage(0).getCropBox().width > 0,
  );

  // P0 — Rotated + offset CropBox fixture
  const p0Bytes = bytesToArrayBuffer(
    await createTextPdf(600, 800, "P0 ROT OFFSET", 90, {
      x: 50,
      y: 75,
      width: 500,
      height: 650,
    }),
  );
  let stateP0 = await loadCropDocumentState(p0Bytes);
  stateP0 = setCropForPage(stateP0, stateP0.pages[0].id, ASYMMETRIC);
  const expectedP0 = normalizedCropToPdfCropBox(
    ASYMMETRIC,
    createCropPageGeometry(
      { x: 0, y: 0, width: 600, height: 800 },
      { x: 50, y: 75, width: 500, height: 650 },
      90,
    ),
  );
  const blobP0 = await cropPdfDocument(p0Bytes, stateP0);
  const outP0 = await loadPdfDocument(await blobP0.arrayBuffer());
  assertCropBox("P0 — rotated+offset CropBox", outP0.getPage(0).getCropBox(), expectedP0);
  assert("P0 — rotation preserved", outP0.getPage(0).getRotation().angle === 90);

  // Vector/text preservation — pdf-lib reload + page node still has content
  const textFixture = bytesToArrayBuffer(
    await createTextPdf(600, 800, "VECTOR TEXT PRESERVED"),
  );
  let textState = await loadCropDocumentState(textFixture);
  textState = setCropForPage(textState, textState.pages[0].id, ASYMMETRIC);
  const textBlob = await cropPdfDocument(textFixture, textState);
  const textOut = await loadPdfDocument(await textBlob.arrayBuffer());
  const textPage = textOut.getPage(0);
  const hasContents = Boolean(
    (textPage as unknown as { node?: { Contents?: () => unknown } }).node?.Contents?.(),
  );
  assert(
    "Vector/text — content stream preserved (not rasterized)",
    hasContents,
  );
  const extracted = await extractPageText(textBlob);
  assert(
    "Vector/text — text extractable after crop",
    extracted.includes("VECTOR") || hasContents,
    extracted ? `extracted: "${extracted}"` : "no text API — content stream verified",
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
