/**
 * Fill PDF form detection tests (Phase 123B).
 * Run: npx tsx scripts/verify-fill-pdf-detection.ts
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt";
import {
  bytesContainAcroFormReference,
  bytesContainXfaReference,
  detectDocumentFormType,
  detectExistingDigitalSignatures,
  hasJSActions,
  isPdfBytes,
  loadFillPdfDocumentState,
} from "../lib/tools/fill-pdf";
import { FillPdfError } from "../lib/tools/fill-pdf/types";

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

async function createAcroFormPdfBytes(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();
  const textField = form.createTextField("applicant.name");
  textField.setText("Jane Doe");
  textField.addToPage(page, { x: 72, y: 700, width: 200, height: 24 });
  return pdf.save();
}

async function createNoFormPdfBytes(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  page.drawText("Plain PDF without forms", {
    x: 72,
    y: 700,
    size: 12,
    font: await pdf.embedStandardFont(StandardFonts.Helvetica),
    color: rgb(0, 0, 0),
  });
  return pdf.save();
}

function createXfaOnlyPdfBytes(): Uint8Array {
  const body = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R /XFA 3 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [4 0 R] /Count 1 >>
endobj
3 0 obj
<< /xdp:xdp xmlns:xdp="http://ns.adobe.com/xdp/"><template></template></xdp:xdp>
>>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000074 00000 n 
0000000131 00000 n 
0000000260 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
352
%%EOF`;
  return new TextEncoder().encode(body);
}

function createHybridPdfBytes(): Uint8Array {
  const body = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R /AcroForm 5 0 R /XFA 3 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [4 0 R] /Count 1 >>
endobj
3 0 obj
<< /xdp:xdp xmlns:xdp="http://ns.adobe.com/xdp/"><template></template></xdp:xdp>
>>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Annots [6 0 R] >>
endobj
5 0 obj
<< /Fields [6 0 R] >>
endobj
6 0 obj
<< /Type /Annot /Subtype /Widget /FT /Tx /T (hybrid.name) /Rect [72 700 272 724] /P 4 0 R /V (Hybrid) >>
endobj
xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000090 00000 n 
0000000147 00000 n 
0000000276 00000 n 
0000000378 00000 n 
0000000416 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
520
%%EOF`;
  return new TextEncoder().encode(body);
}

function createSignatureFieldPdfBytes(): Uint8Array {
  const body = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R /AcroForm 5 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [4 0 R] /Count 1 >>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Annots [6 0 R] >>
endobj
5 0 obj
<< /Fields [6 0 R] /SigFlags 3 >>
endobj
6 0 obj
<< /Type /Annot /Subtype /Widget /FT /Sig /T (signer.signature) /Rect [72 650 272 690] /P 4 0 R >>
endobj
xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000074 00000 n 
0000000131 00000 n 
0000000210 00000 n 
0000000312 00000 n 
0000000350 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
450
%%EOF`;
  return new TextEncoder().encode(body);
}

function createUnknownFieldPdfBytes(): Uint8Array {
  const body = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R /AcroForm 5 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [4 0 R] /Count 1 >>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Annots [6 0 R] >>
endobj
5 0 obj
<< /Fields [6 0 R] >>
endobj
6 0 obj
<< /Type /Annot /Subtype /Widget /FT /CustomUnknown /T (legacy.unknown) /Rect [72 600 272 624] /P 4 0 R >>
endobj
xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000074 00000 n 
0000000131 00000 n 
0000000210 00000 n 
0000000312 00000 n 
0000000350 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
455
%%EOF`;
  return new TextEncoder().encode(body);
}

function createSignedPdfBytes(): Uint8Array {
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

function createJavaScriptPdfBytes(): Uint8Array {
  const body = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R /OpenAction 3 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [4 0 R] /Count 1 >>
endobj
3 0 obj
<< /S /JavaScript /JS (app.alert('test');) >>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000074 00000 n 
0000000131 00000 n 
0000000200 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
270
%%EOF`;
  return new TextEncoder().encode(body);
}

async function createButtonPdfBytes(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();
  const button = form.createButton("actions.submit");
  button.addToPage("Submit", page, { x: 72, y: 650, width: 120, height: 28 });
  return pdf.save();
}

async function expectFillPdfError(
  name: string,
  run: () => Promise<unknown>,
  code: FillPdfError["code"],
) {
  try {
    await run();
    assert(name, false, `expected FillPdfError ${code}`);
  } catch (error) {
    assert(
      name,
      error instanceof FillPdfError && error.code === code,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function run() {
  console.log("\nFill PDF detection verification\n");

  const acroBytes = await createAcroFormPdfBytes();
  const noFormBytes = await createNoFormPdfBytes();
  const xfaBytes = createXfaOnlyPdfBytes();
  const hybridBytes = createHybridPdfBytes();
  const signatureFieldBytes = createSignatureFieldPdfBytes();
  const unknownFieldBytes = createUnknownFieldPdfBytes();
  const signedBytes = createSignedPdfBytes();
  const jsBytes = createJavaScriptPdfBytes();
  const buttonBytes = await createButtonPdfBytes();
  const corruptBytes = new TextEncoder().encode("not a pdf");

  assert("isPdfBytes accepts valid PDF", isPdfBytes(acroBytes));
  assert("isPdfBytes rejects non-PDF", !isPdfBytes(corruptBytes));

  assert(
    "AcroForm detection",
    (await detectDocumentFormType(acroBytes)) === "ACROFORM",
  );
  assert(
    "No-form detection",
    (await detectDocumentFormType(noFormBytes)) === "NO_FORM",
  );
  assert(
    "XFA detection",
    (await detectDocumentFormType(xfaBytes)) === "XFA",
  );
  assert(
    "Hybrid detection",
    (await detectDocumentFormType(hybridBytes)) === "HYBRID_XFA_ACROFORM",
  );

  assert("bytesContainXfaReference", bytesContainXfaReference(hybridBytes));
  assert(
    "AcroForm byte scan or field detection",
    bytesContainAcroFormReference(acroBytes) ||
      (await detectDocumentFormType(acroBytes)) === "ACROFORM",
  );
  assert("digital signature flag", detectExistingDigitalSignatures(signedBytes));
  assert("hasJSActions warning flag", hasJSActions(jsBytes));

  await expectFillPdfError(
    "Corrupt PDF rejected",
    () => loadFillPdfDocumentState(bytesToArrayBuffer(corruptBytes)),
    "WRONG_FILE_TYPE",
  );

  const encrypted = await encryptPDF(acroBytes, "secret123", {
    ownerPassword: "secret123",
    algorithm: "AES-256",
  });

  await expectFillPdfError(
    "Password PDF rejected",
    () => loadFillPdfDocumentState(bytesToArrayBuffer(encrypted)),
    "PASSWORD_PDF",
  );

  await expectFillPdfError(
    "XFA rejected before getForm",
    () => loadFillPdfDocumentState(bytesToArrayBuffer(xfaBytes)),
    "XFA_UNSUPPORTED",
  );

  await expectFillPdfError(
    "Hybrid rejected before getForm",
    () => loadFillPdfDocumentState(bytesToArrayBuffer(hybridBytes)),
    "HYBRID_XFA_UNSUPPORTED",
  );

  await expectFillPdfError(
    "No-form rejected",
    () => loadFillPdfDocumentState(bytesToArrayBuffer(noFormBytes)),
    "NO_FORM_FIELDS",
  );

  const acroState = await loadFillPdfDocumentState(bytesToArrayBuffer(acroBytes));
  assert("AcroForm loads fields", acroState.fields.length === 1);
  assert("AcroForm document type", acroState.documentFormType === "ACROFORM");

  const signatureState = await loadFillPdfDocumentState(
    bytesToArrayBuffer(signatureFieldBytes),
  );
  assert(
    "Signature field detected",
    signatureState.fields.some((field) => field.kind === "SIGNATURE"),
  );

  const buttonState = await loadFillPdfDocumentState(bytesToArrayBuffer(buttonBytes));
  assert(
    "Button field detected",
    buttonState.fields.some((field) => field.kind === "BUTTON"),
  );

  try {
    await loadFillPdfDocumentState(bytesToArrayBuffer(unknownFieldBytes));
    assert("Unknown field PDF handled", true);
  } catch (error) {
    assert(
      "Unknown field PDF handled",
      error instanceof FillPdfError && error.code === "NO_FORM_FIELDS",
      error instanceof Error ? error.message : String(error),
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
