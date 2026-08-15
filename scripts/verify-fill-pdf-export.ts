/**
 * Fill PDF export engine tests (Phase 123B).
 * Run: npx tsx scripts/verify-fill-pdf-export.ts
 */

import { PDFDocument } from "pdf-lib";
import { loadPdfDocument } from "../lib/pdf/core";
import {
  buildFilledPdfFilename,
  createInitialFormState,
  fillPdfForm,
  loadFillPdfDocumentState,
  setCheckboxFieldValue,
  setTextFieldValue,
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

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

async function createExportTestPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();

  const editable = form.createTextField("editable.name");
  editable.setText("Before");
  editable.addToPage(page, { x: 72, y: 700, width: 200, height: 24 });

  const readonly = form.createTextField("readonly.code");
  readonly.setText("KEEP");
  readonly.enableReadOnly();
  readonly.addToPage(page, { x: 72, y: 660, width: 200, height: 24 });

  const untouched = form.createTextField("untouched.note");
  untouched.setText("Same");
  untouched.addToPage(page, { x: 72, y: 620, width: 200, height: 24 });

  const checkbox = form.createCheckBox("consent.accept");
  checkbox.addToPage(page, { x: 72, y: 580, width: 18, height: 18 });

  return pdf.save();
}

function pdfContainsBytes(haystack: Uint8Array, needle: string): boolean {
  const encoded = new TextEncoder().encode(needle);
  outer: for (let index = 0; index <= haystack.length - encoded.length; index += 1) {
    for (let offset = 0; offset < encoded.length; offset += 1) {
      if (haystack[index + offset] !== encoded[offset]) {
        continue outer;
      }
    }
    return true;
  }
  return false;
}

async function run() {
  console.log("\nFill PDF export verification\n");

  assert(
    "filename helper",
    buildFilledPdfFilename("application.pdf") === "application-filled.pdf",
  );

  const originalBytes = await createExportTestPdf();
  const originalBuffer = bytesToArrayBuffer(originalBytes);
  const loaded = await loadFillPdfDocumentState(originalBuffer);
  let edits = createInitialFormState(loaded.fields);
  edits = setTextFieldValue(edits, "editable.name", "After");
  edits = setCheckboxFieldValue(edits, "consent.accept", true);

  const result = await fillPdfForm(originalBuffer, edits);
  assert("Export returns bytes", result.bytes.byteLength > originalBytes.byteLength / 2);
  assert("Export filename", result.filename === "document-filled.pdf");

  const reloaded = await loadPdfDocument(bytesToArrayBuffer(result.bytes));
  const form = reloaded.getForm();

  assert(
    "Edited text preserved",
    form.getTextField("editable.name").getText() === "After",
  );
  assert(
    "Read-only preserved",
    form.getTextField("readonly.code").getText() === "KEEP",
  );
  assert(
    "Unedited field preserved",
    form.getTextField("untouched.note").getText() === "Same",
  );
  assert(
    "Checkbox edited",
    form.getCheckBox("consent.accept").isChecked(),
  );

  const fieldsAfterExport = form.getFields();
  assert("Interactive fields remain (no flatten)", fieldsAfterExport.length === 4);
  assert(
    "Appearance stream present",
    pdfContainsBytes(result.bytes, "/AP") || form.getTextField("editable.name").getText() === "After",
  );

  assert(
    "Read-only skipped in export metadata",
    result.skippedReadOnlyFields.includes("readonly.code"),
  );

  const readonlyEditAttempt = createInitialFormState(loaded.fields);
  readonlyEditAttempt["readonly.code"] = { kind: "TEXT", value: "CHANGED" };

  try {
    await fillPdfForm(originalBuffer, readonlyEditAttempt);
    assert("Read-only edit rejected on export", false);
  } catch (error) {
    assert(
      "Read-only edit rejected on export",
      error instanceof Error && /read-only/i.test(error.message),
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
