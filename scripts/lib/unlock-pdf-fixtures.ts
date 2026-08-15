/**
 * Shared synthetic fixtures for Unlock PDF verification (Phase 127B).
 */

import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { protectPdfWithPassword } from "../../lib/security-tools/pdf/protect";
import { UNLOCK_PDF_TEST_PASSWORD } from "../../lib/security-tools/pdf/unlock-constants";
import {
  createAnnotationPdfBytes,
  createCorruptPdfBytes,
  createFormPdfBytes,
  createMultiPagePdfBytes,
  createPlainTextPdfBytes,
  createRotatedPdfBytes,
  createSignedPdfBytes,
} from "./protect-pdf-fixtures";

export { UNLOCK_PDF_TEST_PASSWORD, createCorruptPdfBytes, createSignedPdfBytes };

export const UNLOCK_FIXTURE_MARKER = "PROTECT-UNLOCK-TEST-12345";

export async function createUnlockPlainTextPdfBytes(
  text = UNLOCK_FIXTURE_MARKER,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  page.drawText(text, {
    x: 72,
    y: 700,
    size: 12,
    font: await pdf.embedStandardFont(StandardFonts.Helvetica),
    color: rgb(0, 0, 0),
  });
  return pdf.save();
}

export async function createUnlockRotatedPdfBytes(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  page.setRotation(degrees(90));
  page.drawText(`${UNLOCK_FIXTURE_MARKER}-ROT90`, {
    x: 72,
    y: 700,
    size: 12,
    font: await pdf.embedStandardFont(StandardFonts.Helvetica),
    color: rgb(0, 0, 0),
  });
  return pdf.save();
}

export async function createUnlockFormPdfBytes(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();
  const field = form.createTextField("unlock.fixture.name");
  field.setText(`${UNLOCK_FIXTURE_MARKER}-FORM`);
  field.addToPage(page, { x: 72, y: 700, width: 240, height: 24 });
  return pdf.save();
}

export async function createUnlockMultiPagePdfBytes(pageCount = 3): Promise<Uint8Array> {
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

export async function protectUnlockFixturePdf(
  sourceBytes: Uint8Array,
  password = UNLOCK_PDF_TEST_PASSWORD,
): Promise<Uint8Array> {
  return protectPdfWithPassword(Buffer.from(sourceBytes), password);
}

export async function createUnlockEncryptedFixture(
  password = UNLOCK_PDF_TEST_PASSWORD,
): Promise<Uint8Array> {
  const source = await createUnlockPlainTextPdfBytes();
  return protectUnlockFixturePdf(source, password);
}

export async function createUnlockAnnotationFixture(): Promise<Uint8Array> {
  return protectUnlockFixturePdf(createAnnotationPdfBytes());
}

export async function createUnlockFormFixture(): Promise<Uint8Array> {
  return protectUnlockFixturePdf(await createUnlockFormPdfBytes());
}

export async function createUnlockMultiPageFixture(pageCount = 3): Promise<Uint8Array> {
  return protectUnlockFixturePdf(await createUnlockMultiPagePdfBytes(pageCount));
}

export async function createUnlockRotatedFixture(): Promise<Uint8Array> {
  return protectUnlockFixturePdf(await createUnlockRotatedPdfBytes());
}

export async function createUnencryptedPlainPdfBytes(): Promise<Uint8Array> {
  return createPlainTextPdfBytes(UNLOCK_FIXTURE_MARKER);
}
