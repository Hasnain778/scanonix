/**
 * Redact PDF export engine tests (Phase 125B).
 * Run: npx tsx scripts/verify-redact-pdf-export.ts
 */

import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { loadPdfDocument } from "../lib/pdf/core";
import {
  addRedaction,
  buildRedactedPdfFilename,
  loadRedactionDocumentState,
  redactPdfDocument,
  RedactPdfError,
} from "../lib/tools/redact-pdf";

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

const SECRET = "SECRET-12345";
const SECRET_RECT = { x: 0.05, y: 0.12, width: 0.55, height: 0.08 };

async function createSecretPdf(
  width = 612,
  height = 792,
  rotation: 0 | 90 | 180 | 270 = 0,
  cropBox?: { x: number; y: number; width: number; height: number },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([width, height]);

  page.drawText("PUBLIC HEADER", {
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
  page.drawText("PUBLIC FOOTER", {
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

async function run() {
  console.log("\nRedact PDF export verification\n");

  assert(
    "TEST A — filename basic",
    buildRedactedPdfFilename("document.pdf") === "document-redacted.pdf",
  );
  assert(
    "TEST B — uppercase extension",
    buildRedactedPdfFilename("DOCUMENT.PDF") === "DOCUMENT-redacted.pdf",
  );
  assert(
    "TEST C — dotted name",
    buildRedactedPdfFilename("my.document.pdf") === "my.document-redacted.pdf",
  );

  const bytes = bytesToArrayBuffer(await createSecretPdf());
  let state = await loadRedactionDocumentState(bytes);
  state = addRedaction(state, 0, SECRET_RECT);

  const result = await redactPdfDocument(bytes, state, "document.pdf");
  assert("TEST D — export returns bytes", result.bytes.byteLength > 1000);
  assert(
    "TEST E — export filename",
    result.filename === "document-redacted.pdf",
  );
  assert("TEST F — redacted page count", result.redactedPageCount === 1);
  assert("TEST G — clean page count", result.cleanPageCount === 0);

  const reloaded = await loadPdfDocument(bytesToArrayBuffer(result.bytes));
  assert("TEST H — export reloads", reloaded.getPageCount() === 1);

  let noRedactionThrew = false;
  try {
    await redactPdfDocument(bytes, await loadRedactionDocumentState(bytes));
  } catch (error) {
    noRedactionThrew =
      error instanceof RedactPdfError && error.code === "NO_REDACTIONS";
  }
  assert("TEST I — no redactions rejected", noRedactionThrew);

  const multiPdf = await PDFDocument.create();
  multiPdf.addPage([612, 792]);
  multiPdf.addPage([612, 792]);
  const multiBytes = bytesToArrayBuffer(await multiPdf.save());
  let multiState = await loadRedactionDocumentState(multiBytes);
  multiState = addRedaction(multiState, 0, SECRET_RECT);
  const multiResult = await redactPdfDocument(multiBytes, multiState);
  const multiOut = await loadPdfDocument(bytesToArrayBuffer(multiResult.bytes));
  assert("TEST J — multi-page count preserved", multiOut.getPageCount() === 2);
  assert(
    "TEST K — hybrid counts",
    multiResult.redactedPageCount === 1 && multiResult.cleanPageCount === 1,
  );

  let progressCalls = 0;
  await redactPdfDocument(bytes, state, "document.pdf", () => {
    progressCalls += 1;
  });
  assert("TEST L — progress callback", progressCalls === 1);

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
