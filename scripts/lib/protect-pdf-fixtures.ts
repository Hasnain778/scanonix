/**
 * Shared synthetic fixtures for Protect PDF verification (Phase 126B).
 */

import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt";
import { PROTECT_PDF_TEST_PASSWORD } from "../../lib/security-tools/pdf/protect-constants";

export { PROTECT_PDF_TEST_PASSWORD };

export const FIXTURE_MARKER = "PROTECT-FIXTURE-MARKER-12345";

export function createCorruptPdfBytes(): Uint8Array {
  return new TextEncoder().encode("not a pdf");
}

export function createSignedPdfBytes(): Uint8Array {
  const body = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R /AcroForm 5 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [4 0 R] /Count 1 >>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
5 0 obj
<< /Fields [6 0 R] >>
endobj
6 0 obj
<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /ByteRange [0 100 200 100] /Contents <0000> >>
endobj
xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000074 00000 n 
0000000131 00000 n 
0000000200 00000 n 
0000000262 00000 n 
0000000300 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
410
%%EOF`;
  return new TextEncoder().encode(body);
}

export function createAnnotationPdfBytes(): Uint8Array {
  const body = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Annots [4 0 R] >>
endobj
4 0 obj
<< /Type /Annot /Subtype /Text /Rect [72 700 120 730] /Contents (${FIXTURE_MARKER}) /T (fixture-note) >>
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000067 00000 n 
0000000124 00000 n 
0000000205 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
310
%%EOF`;
  return new TextEncoder().encode(body);
}

export async function createPlainTextPdfBytes(
  text = FIXTURE_MARKER,
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

export async function createRotatedPdfBytes(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  page.setRotation(degrees(90));
  page.drawText(`${FIXTURE_MARKER}-ROT90`, {
    x: 72,
    y: 700,
    size: 12,
    font: await pdf.embedStandardFont(StandardFonts.Helvetica),
    color: rgb(0, 0, 0),
  });
  return pdf.save();
}

export async function createFormPdfBytes(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();
  const field = form.createTextField("protect.fixture.name");
  field.setText(`${FIXTURE_MARKER}-FORM`);
  field.addToPage(page, { x: 72, y: 700, width: 240, height: 24 });
  return pdf.save();
}

export async function createMultiPagePdfBytes(pageCount = 3): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedStandardFont(StandardFonts.Helvetica);

  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([612, 792]);
    page.drawText(`${FIXTURE_MARKER}-PAGE-${index + 1}`, {
      x: 72,
      y: 700,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
  }

  return pdf.save();
}

export async function createEncryptedPdfBytes(
  password = PROTECT_PDF_TEST_PASSWORD,
): Promise<Uint8Array> {
  const source = await createPlainTextPdfBytes();
  return encryptPDF(source, password, {
    ownerPassword: password,
    algorithm: "AES-256",
  });
}

export async function protectFixturePdf(
  sourceBytes: Uint8Array,
  password = PROTECT_PDF_TEST_PASSWORD,
): Promise<Uint8Array> {
  const { protectPdfWithPassword } = await import("../../lib/security-tools/pdf/protect");
  return protectPdfWithPassword(Buffer.from(sourceBytes), password);
}
