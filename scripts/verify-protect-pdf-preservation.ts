/**
 * Protect PDF content preservation verification (Phase 126B).
 * Run: npx tsx scripts/verify-protect-pdf-preservation.ts
 */

import { degrees, PDFDocument } from "pdf-lib";
import { decryptPDF } from "@pdfsmaller/pdf-decrypt";
import { loadPdfJsDocumentNode } from "../lib/tools/redact-pdf/pdfjs-node";
import {
  createAnnotationPdfBytes,
  createFormPdfBytes,
  createMultiPagePdfBytes,
  createPlainTextPdfBytes,
  createRotatedPdfBytes,
  FIXTURE_MARKER,
  PROTECT_PDF_TEST_PASSWORD,
  protectFixturePdf,
} from "./lib/protect-pdf-fixtures";

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

function decodeLatin1(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
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

async function decryptProtected(source: Uint8Array): Promise<Uint8Array> {
  const protectedBytes = await protectFixturePdf(source);
  return decryptPDF(protectedBytes, PROTECT_PDF_TEST_PASSWORD);
}

async function run() {
  console.log("\nProtect PDF preservation verification\n");

  const plain = await createPlainTextPdfBytes();
  const plainProtected = await protectFixturePdf(plain);
  const plainDecrypted = await decryptPDF(plainProtected, PROTECT_PDF_TEST_PASSWORD);
  const plainText = await extractPdfText(plainDecrypted);
  assert(
    "A text marker survives protect/decrypt round-trip",
    plainText.includes(FIXTURE_MARKER),
    plainText.trim() || "no text extracted",
  );

  const multi = await createMultiPagePdfBytes(3);
  const sourcePages = (await PDFDocument.load(multi)).getPageCount();
  const multiDecrypted = await decryptProtected(multi);
  const restoredPages = (await PDFDocument.load(multiDecrypted)).getPageCount();
  assert("B page count preserved", restoredPages === sourcePages, `${restoredPages} vs ${sourcePages}`);

  const rotated = await createRotatedPdfBytes();
  const sourceDoc = await PDFDocument.load(rotated);
  const sourceRotation = sourceDoc.getPage(0).getRotation().angle;
  const rotatedDecrypted = await decryptProtected(rotated);
  const restoredDoc = await PDFDocument.load(rotatedDecrypted);
  const restoredRotation = restoredDoc.getPage(0).getRotation().angle;
  assert(
    "C page rotation preserved",
    restoredRotation === sourceRotation,
    `${restoredRotation} vs ${sourceRotation}`,
  );
  const rotatedText = await extractPdfText(rotatedDecrypted);
  assert(
    "D rotated page text preserved",
    rotatedText.includes(`${FIXTURE_MARKER}-ROT90`),
    rotatedText.trim() || "no text extracted",
  );

  const formPdf = await createFormPdfBytes();
  const formDecrypted = await decryptProtected(formPdf);
  const formDoc = await PDFDocument.load(formDecrypted);
  const fieldValue = formDoc.getForm().getTextField("protect.fixture.name").getText();
  assert(
    "E AcroForm field value preserved",
    fieldValue === `${FIXTURE_MARKER}-FORM`,
    fieldValue ?? "missing",
  );
  assert(
    "F AcroForm field name preserved",
    formDoc.getForm().getFields().some((field) => field.getName() === "protect.fixture.name"),
  );

  const annotationPdf = createAnnotationPdfBytes();
  const annotationDecrypted = await decryptProtected(annotationPdf);
  const annotationRaw = decodeLatin1(annotationDecrypted);
  assert("G annotation marker preserved", annotationRaw.includes(FIXTURE_MARKER));
  assert("H /Annots structure preserved", annotationRaw.includes("/Annots"));
  assert("I text annotation subtype preserved", annotationRaw.includes("/Subtype /Text"));

  const plainDoc = await PDFDocument.load(plainDecrypted);
  const pageSize = plainDoc.getPage(0).getSize();
  assert(
    "J page dimensions preserved",
    pageSize.width === 612 && pageSize.height === 792,
    `${pageSize.width}x${pageSize.height}`,
  );

  const rotatedAfter = restoredDoc.getPage(0).getRotation();
  assert(
    "K restored rotation equals 90 degrees",
    rotatedAfter.angle === degrees(90).angle,
    String(rotatedAfter.angle),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
