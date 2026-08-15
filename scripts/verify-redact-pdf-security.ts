/**
 * Security proof tests for Redact PDF (Phase 125B) — tests A–Q.
 * Run: npx tsx scripts/verify-redact-pdf-security.ts
 */

import { createCanvas } from "@napi-rs/canvas";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { loadPdfJsDocumentNode } from "../lib/tools/redact-pdf/pdfjs-node";
import sharp from "sharp";
import { loadPdfDocument } from "../lib/pdf/core";
import {
  addRedaction,
  loadRedactionDocumentState,
  redactPdfDocument,
  RedactPdfError,
} from "../lib/tools/redact-pdf";

const SECRET = "SECRET-12345";
const SECRET_RECT = { x: 0.05, y: 0.12, width: 0.55, height: 0.08 };
const PUBLIC_HEADER = "PUBLIC HEADER";
const PUBLIC_FOOTER = "PUBLIC FOOTER";

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

function pdfContainsString(bytes: Uint8Array, needle: string): boolean {
  const encoded = new TextEncoder().encode(needle);
  outer: for (let index = 0; index <= bytes.length - encoded.length; index += 1) {
    for (let offset = 0; offset < encoded.length; offset += 1) {
      if (bytes[index + offset] !== encoded[offset]) {
        continue outer;
      }
    }
    return true;
  }
  return false;
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const doc = await loadPdfJsDocumentNode(bytes);
  let text = "";

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    text += `${content.items.map((item) => ("str" in item ? item.str : "")).join(" ")}\n`;
  }

  return text;
}

async function extractPageText(bytes: Uint8Array, pageIndex: number): Promise<string> {
  const doc = await loadPdfJsDocumentNode(bytes);
  const page = await doc.getPage(pageIndex + 1);
  const content = await page.getTextContent();
  return content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
}

function pageHasTextOperators(bytes: Uint8Array): boolean {
  const raw = new TextDecoder("latin1").decode(bytes);
  return /\(([^)]*SECRET-12345[^)]*)\)\s*Tj/.test(raw) ||
    /\(([^)]*SECRET-12345[^)]*)\)\s*'/.test(raw);
}

async function createSecretTextPdf(
  width = 612,
  height = 792,
  rotation: 0 | 90 | 180 | 270 = 0,
  cropBox?: { x: number; y: number; width: number; height: number },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([width, height]);

  page.drawText(PUBLIC_HEADER, {
    x: 40,
    y: height - 60,
    size: 14,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText(SECRET, {
    x: 40,
    y: height - 140,
    size: 12,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText(PUBLIC_FOOTER, {
    x: 40,
    y: height - 200,
    size: 12,
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

async function createFormSecretPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();
  const field = form.createTextField("secret.field");
  field.setText(SECRET);
  field.addToPage(page, { x: 40, y: 650, width: 220, height: 24 });
  page.drawText(PUBLIC_HEADER, {
    x: 40,
    y: 720,
    size: 14,
    font: await pdf.embedFont(StandardFonts.Helvetica),
  });
  return pdf.save();
}

async function createImageSecretPdf(): Promise<Uint8Array> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120">
    <rect width="100%" height="100%" fill="white"/>
    <text x="20" y="70" font-size="36" font-family="Arial">${SECRET}</text>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const image = await pdf.embedPng(png);
  page.drawImage(image, { x: 40, y: heightToY(792, 140, 120), width: 400, height: 120 });
  page.drawText(PUBLIC_HEADER, {
    x: 40,
    y: 720,
    size: 14,
    font: await pdf.embedFont(StandardFonts.Helvetica),
  });
  return pdf.save();
}

function heightToY(pageHeight: number, visualTop: number, boxHeight: number): number {
  return pageHeight - visualTop - boxHeight;
}

async function redactFixture(
  fixtureBytes: Uint8Array,
  pageIndex: number,
  rect = SECRET_RECT,
): Promise<Uint8Array> {
  const buffer = bytesToArrayBuffer(fixtureBytes);
  let state = await loadRedactionDocumentState(buffer);
  state = addRedaction(state, pageIndex, rect);
  const result = await redactPdfDocument(buffer, state);
  return result.bytes;
}

async function sampleRegionIsMostlyDark(
  bytes: Uint8Array,
  region: { x: number; y: number; width: number; height: number },
  darkRatio = 0.7,
): Promise<boolean> {
  const doc = await loadPdfJsDocumentNode(bytes);
  const jsPage = await doc.getPage(1);
  const viewport = jsPage.getViewport({ scale: 0.5 });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const context = canvas.getContext("2d");
  if (!context) return false;

  await jsPage.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
    canvas: canvas as unknown as HTMLCanvasElement,
  }).promise;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let darkCount = 0;
  let samples = 0;
  const startX = Math.floor(canvas.width * region.x);
  const endX = Math.floor(canvas.width * (region.x + region.width));
  const startY = Math.floor(canvas.height * region.y);
  const endY = Math.floor(canvas.height * (region.y + region.height));

  for (let y = startY; y < endY; y += 4) {
    for (let x = startX; x < endX; x += 4) {
      const index = (y * canvas.width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      if (r < 40 && g < 40 && b < 40) darkCount += 1;
      samples += 1;
    }
  }

  return samples > 0 && darkCount / samples > darkRatio;
}

async function sampleRedactedPixels(bytes: Uint8Array): Promise<boolean> {
  return sampleRegionIsMostlyDark(bytes, SECRET_RECT);
}

async function run() {
  console.log("\nRedact PDF security verification (A–Q)\n");

  const baseFixture = await createSecretTextPdf();
  const redacted = await redactFixture(baseFixture, 0);

  // TEST A — visual blackout (pixel sampling)
  assert(
    "TEST A — redaction region visually black",
    await sampleRedactedPixels(redacted),
  );

  // TEST B — PDF.js text extraction
  const extracted = await extractPdfText(redacted);
  assert(
    "TEST B — PDF.js extraction excludes secret",
    !extracted.includes(SECRET),
    extracted,
  );

  // TEST C — raw byte scan
  assert(
    "TEST C — raw bytes exclude secret",
    !pdfContainsString(redacted, SECRET),
  );

  // TEST D — pdf-lib inspection
  const pdfLibDoc = await loadPdfDocument(bytesToArrayBuffer(redacted));
  assert("TEST D — pdf-lib loads redacted output", pdfLibDoc.getPageCount() === 1);
  assert(
    "TEST D — pdf-lib byte scan excludes secret",
    !pdfContainsString(redacted, SECRET),
  );

  // TEST E — no removable overlay (no original content stream text operators)
  assert(
    "TEST E — no text operators with secret on redacted page",
    !pageHasTextOperators(redacted),
  );

  // TEST F — copy/paste proxy (text extraction empty for secret region)
  assert(
    "TEST F — secret not selectable via text extraction",
    !(await extractPageText(redacted, 0)).includes(SECRET),
  );

  // TEST G — unredacted header region on raster page remains non-black
  const headerRegion = { x: 0.02, y: 0.02, width: 0.6, height: 0.08 };
  assert(
    "TEST G — public header region not fully blacked out",
    !(await sampleRegionIsMostlyDark(redacted, headerRegion)),
  );

  // TEST H — hybrid: clean page remains searchable
  const multiPdf = await PDFDocument.create();
  const font = await multiPdf.embedFont(StandardFonts.Helvetica);
  const page1 = multiPdf.addPage([612, 792]);
  page1.drawText(SECRET, { x: 40, y: 650, size: 12, font });
  const page2 = multiPdf.addPage([612, 792]);
  page2.drawText("CLEAN PAGE TEXT", { x: 40, y: 700, size: 14, font });
  const multiRedacted = await redactFixture(await multiPdf.save(), 0);
  const cleanPageText = await extractPageText(multiRedacted, 1);
  assert(
    "TEST H — clean page text searchable",
    cleanPageText.includes("CLEAN PAGE TEXT"),
    cleanPageText,
  );

  // TEST I — redacted page not searchable
  const redactedPageText = await extractPageText(multiRedacted, 0);
  assert(
    "TEST I — redacted page secret not searchable",
    !redactedPageText.includes(SECRET),
    redactedPageText,
  );

  // TEST J — rotation 90°
  const rot90 = await redactFixture(await createSecretTextPdf(612, 792, 90), 0);
  assert(
    "TEST J — rotation 90° secret removed",
    !pdfContainsString(rot90, SECRET),
  );

  // TEST K — rotation 180°
  const rot180 = await redactFixture(await createSecretTextPdf(612, 792, 180), 0);
  assert(
    "TEST K — rotation 180° secret removed",
    !pdfContainsString(rot180, SECRET),
  );

  // TEST L — rotation 270°
  const rot270 = await redactFixture(await createSecretTextPdf(612, 792, 270), 0);
  assert(
    "TEST L — rotation 270° secret removed",
    !pdfContainsString(rot270, SECRET),
  );

  // TEST M — CropBox smaller than MediaBox
  const cropFixture = await createSecretTextPdf(612, 792, 0, {
    x: 0,
    y: 0,
    width: 500,
    height: 700,
  });
  const cropRedacted = await redactFixture(cropFixture, 0);
  assert(
    "TEST M — CropBox fixture secret removed",
    !pdfContainsString(cropRedacted, SECRET),
  );

  // TEST N — offset CropBox
  const offsetFixture = await createSecretTextPdf(612, 792, 0, {
    x: 50,
    y: 75,
    width: 500,
    height: 650,
  });
  const offsetRedacted = await redactFixture(offsetFixture, 0);
  assert(
    "TEST N — offset CropBox secret removed",
    !pdfContainsString(offsetRedacted, SECRET),
  );

  // TEST O — form field secret removed from bytes
  const formRedacted = await redactFixture(await createFormSecretPdf(), 0, {
    x: 0.05,
    y: 0.75,
    width: 0.5,
    height: 0.1,
  });
  assert(
    "TEST O — form field secret absent from output bytes",
    !pdfContainsString(formRedacted, SECRET),
  );

  // TEST P — image pixel secret removed
  const IMAGE_SECRET_RECT = { x: 0.05, y: 0.15, width: 0.7, height: 0.2 };
  const imageRedacted = await redactFixture(await createImageSecretPdf(), 0, IMAGE_SECRET_RECT);
  assert(
    "TEST P — image secret absent from bytes",
    !pdfContainsString(imageRedacted, SECRET),
  );
  assert(
    "TEST P — image region visually black",
    await sampleRegionIsMostlyDark(imageRedacted, IMAGE_SECRET_RECT),
  );

  // TEST Q — raster failure throws RASTERIZATION_FAILED, never exports partial output
  const { rasterizeRedactedPage } = await import(
    "../lib/tools/redact-pdf/rasterize-page"
  );

  let rasterFailed = false;
  try {
    await rasterizeRedactedPage({
      pdfBytes: bytesToArrayBuffer(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
      pageIndex: 0,
      rotation: 0,
      redactions: [SECRET_RECT],
    });
  } catch (error) {
    rasterFailed =
      error instanceof RedactPdfError && error.code === "RASTERIZATION_FAILED";
  }
  assert("TEST Q — corrupt PDF raster throws RASTERIZATION_FAILED", rasterFailed);

  let exportAborted = false;
  try {
    const twoPage = await PDFDocument.create();
    const f = await twoPage.embedFont(StandardFonts.Helvetica);
    twoPage.addPage([612, 792]).drawText(SECRET, { x: 40, y: 650, size: 12, font: f });
    twoPage.addPage([612, 792]).drawText(SECRET, { x: 40, y: 650, size: 12, font: f });
    const twoPageBuffer = bytesToArrayBuffer(await twoPage.save());
    let twoState = await loadRedactionDocumentState(twoPageBuffer);
    twoState = addRedaction(twoState, 0, SECRET_RECT);
    twoState = addRedaction(twoState, 1, SECRET_RECT);

    const truncated = twoPageBuffer.slice(0, Math.floor(twoPageBuffer.byteLength / 2));
    await redactPdfDocument(truncated, twoState);
  } catch (error) {
    exportAborted =
      error instanceof RedactPdfError &&
      (error.code === "RASTERIZATION_FAILED" ||
        error.code === "CORRUPT_PDF" ||
        error.code === "EXPORT_FAILED");
  }
  assert(
    "TEST Q — export aborts on raster failure (no silent unredacted page)",
    exportAborted,
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    console.error("P0 SECURITY FAILURE — do not proceed to 125C\n");
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
