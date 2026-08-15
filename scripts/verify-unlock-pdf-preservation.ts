/**
 * Unlock PDF content preservation verification (Phase 127B) — tests K–V.
 * Run: npx tsx scripts/verify-unlock-pdf-preservation.ts
 */

import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { unlockPdfWithPassword } from "../lib/security-tools/pdf/unlock";
import { loadPdfJsDocumentNode } from "../lib/tools/redact-pdf/pdfjs-node";
import {
  createUnlockAnnotationFixture,
  createUnlockFormFixture,
  createUnlockPlainTextPdfBytes,
  createUnlockRotatedFixture,
  protectUnlockFixturePdf,
  UNLOCK_FIXTURE_MARKER,
  UNLOCK_PDF_TEST_PASSWORD,
} from "./lib/unlock-pdf-fixtures";

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

async function unlockProtected(source: Uint8Array): Promise<Uint8Array> {
  const protectedBytes = await protectUnlockFixturePdf(source);
  return unlockPdfWithPassword(Buffer.from(protectedBytes), UNLOCK_PDF_TEST_PASSWORD);
}

async function createMultiPageSource(pageCount = 3): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedStandardFont(StandardFonts.Helvetica);

  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([612, 792]);
    page.drawText(`${UNLOCK_FIXTURE_MARKER}-PAGE-${index + 1}`, {
      x: 72,
      y: 700,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
  }

  return pdf.save();
}

async function run() {
  console.log("\nUnlock PDF preservation verification\n");

  const plain = await createUnlockPlainTextPdfBytes();
  const plainUnlocked = await unlockProtected(plain);
  const plainText = await extractPdfText(plainUnlocked);
  assert(
    "K text marker survives protect/unlock round-trip",
    plainText.includes(UNLOCK_FIXTURE_MARKER),
    plainText.trim() || "no text extracted",
  );

  const multiSource = await createMultiPageSource(3);
  const multiProtected = await protectUnlockFixturePdf(multiSource);
  const sourcePages = (await PDFDocument.load(multiProtected, { ignoreEncryption: true })).getPageCount();
  const multiUnlocked = await unlockPdfWithPassword(
    Buffer.from(multiProtected),
    UNLOCK_PDF_TEST_PASSWORD,
  );
  const restoredPages = (await PDFDocument.load(multiUnlocked)).getPageCount();
  assert("L page count preserved", restoredPages === sourcePages, `${restoredPages} vs ${sourcePages}`);

  const pageText = await extractPdfText(multiUnlocked);
  assert(
    "M page order preserved",
    pageText.includes(`${UNLOCK_FIXTURE_MARKER}-PAGE-1`) &&
      pageText.includes(`${UNLOCK_FIXTURE_MARKER}-PAGE-3`),
  );

  const multiDoc = await PDFDocument.load(multiUnlocked);
  assert("N first page MediaBox preserved", multiDoc.getPage(0).getWidth() === 612);

  const plainDoc = await PDFDocument.load(plainUnlocked);
  const mediaBox = plainDoc.getPage(0).getSize();
  assert(
    "O MediaBox dimensions preserved",
    mediaBox.width === 612 && mediaBox.height === 792,
    `${mediaBox.width}x${mediaBox.height}`,
  );

  const { width, height } = plainDoc.getPage(0).getCropBox();
  assert(
    "P CropBox matches page size",
    width === 612 && height === 792,
    `${width}x${height}`,
  );

  const rotatedProtected = await createUnlockRotatedFixture();
  const rotatedUnlocked = await unlockPdfWithPassword(
    Buffer.from(rotatedProtected),
    UNLOCK_PDF_TEST_PASSWORD,
  );
  const rotatedDoc = await PDFDocument.load(rotatedUnlocked);
  assert(
    "Q page rotation preserved",
    rotatedDoc.getPage(0).getRotation().angle === degrees(90).angle,
    String(rotatedDoc.getPage(0).getRotation().angle),
  );

  const rotatedText = await extractPdfText(rotatedUnlocked);
  assert(
    "R rotated page text preserved",
    rotatedText.includes(`${UNLOCK_FIXTURE_MARKER}-ROT90`),
    rotatedText.trim() || "no text extracted",
  );

  const imagePdf = await (async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);
    const png = await pdf.embedPng(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    );
    page.drawImage(png, { x: 72, y: 700, width: 1, height: 1 });
    page.drawText(`${UNLOCK_FIXTURE_MARKER}-IMAGE`, {
      x: 72,
      y: 680,
      size: 12,
      font: await pdf.embedStandardFont(StandardFonts.Helvetica),
    });
    return pdf.save();
  })();
  const imageUnlocked = await unlockProtected(imagePdf);
  const imageRaw = decodeLatin1(imageUnlocked);
  assert("S image XObject preserved", imageRaw.includes("/Subtype /Image"));
  const imageText = await extractPdfText(imageUnlocked);
  assert(
    "T image page marker preserved",
    imageText.includes(`${UNLOCK_FIXTURE_MARKER}-IMAGE`),
    imageText.trim() || "no text extracted",
  );

  const formProtected = await createUnlockFormFixture();
  const formUnlocked = await unlockPdfWithPassword(
    Buffer.from(formProtected),
    UNLOCK_PDF_TEST_PASSWORD,
  );
  const formDoc = await PDFDocument.load(formUnlocked);
  const fieldValue = formDoc.getForm().getTextField("unlock.fixture.name").getText();
  assert(
    "U AcroForm field value preserved",
    fieldValue === `${UNLOCK_FIXTURE_MARKER}-FORM`,
    fieldValue ?? "missing",
  );
  assert(
    "V AcroForm field name preserved",
    formDoc.getForm().getFields().some((field) => field.getName() === "unlock.fixture.name"),
  );

  const annotationProtected = await createUnlockAnnotationFixture();
  const annotationUnlocked = await unlockPdfWithPassword(
    Buffer.from(annotationProtected),
    UNLOCK_PDF_TEST_PASSWORD,
  );
  const annotationRaw = decodeLatin1(annotationUnlocked);
  assert("W annotation marker preserved", annotationRaw.includes("PROTECT-FIXTURE-MARKER-12345"));
  assert("X /Annots structure preserved", annotationRaw.includes("/Annots"));

  const metadataProtected = await protectUnlockFixturePdf(
    await (async () => {
      const pdf = await PDFDocument.create();
      pdf.setTitle(`${UNLOCK_FIXTURE_MARKER}-TITLE`);
      pdf.setAuthor(`${UNLOCK_FIXTURE_MARKER}-AUTHOR`);
      pdf.addPage([612, 792]);
      return pdf.save();
    })(),
  );
  const metadataUnlocked = await unlockPdfWithPassword(
    Buffer.from(metadataProtected),
    UNLOCK_PDF_TEST_PASSWORD,
  );
  const metadataDoc = await PDFDocument.load(metadataUnlocked);
  assert(
    "Y metadata title preserved",
    metadataDoc.getTitle() === `${UNLOCK_FIXTURE_MARKER}-TITLE`,
    metadataDoc.getTitle() ?? "missing",
  );
  assert(
    "Z metadata author preserved",
    metadataDoc.getAuthor() === `${UNLOCK_FIXTURE_MARKER}-AUTHOR`,
    metadataDoc.getAuthor() ?? "missing",
  );

  console.log("AA bookmarks: NOT VERIFIED (no bookmark fixture)");
  console.log("AB attachments: NOT VERIFIED (attachments not exercised)");

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
