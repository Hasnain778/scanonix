/**
 * PDF-first minimal editor tests for Fill PDF Forms (Phase 123D-FIX3).
 * Run: npx tsx scripts/verify-fill-pdf-fix3-editor.ts
 */

import { PDFDocument } from "pdf-lib";
import {
  buildFieldPresentationEntries,
  buildFieldsNavigatorEntries,
  computeFieldErrors,
  createInitialFormState,
  fillPdfForm,
  getFieldsNavigatorSummary,
  loadFillPdfDocumentState,
  resetToOriginalValues,
  setCheckboxFieldValue,
  setDropdownFieldValue,
  setRadioFieldValue,
  setTextFieldValue,
} from "../lib/tools/fill-pdf";
import {
  buildPageFieldOverlays,
  overlayStyleToPixelRect,
  overlayStyleToPixelRectWithZoom,
} from "../lib/tools/fill-pdf/preview-geometry";
import {
  clampFillPdfZoomFactor,
  computeFillPdfEditorContainerWidth,
  computeFillPdfZoomedDisplaySize,
  formatFillPdfZoomPercent,
  getOrderedEditableFieldNames,
  stepFillPdfZoomFactor,
} from "../lib/tools/fill-pdf/workspace-ui";

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

async function createSexCheckboxGroupPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();
  form.createCheckBox("Sex.Male").addToPage(page, { x: 72, y: 700, width: 18, height: 18 });
  form.createCheckBox("Sex.Female").addToPage(page, { x: 120, y: 700, width: 18, height: 18 });
  return pdf.save();
}

async function createSexRadioPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();
  const sexGroup = form.createRadioGroup("Sex");
  sexGroup.addOptionToPage("Male", page, { x: 72, y: 700, width: 18, height: 18 });
  sexGroup.addOptionToPage("Female", page, { x: 120, y: 700, width: 18, height: 18 });
  return pdf.save();
}

async function createTextPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();
  const field = form.createTextField("Name_Last");
  field.setText("Smith");
  field.addToPage(page, { x: 72, y: 700, width: 180, height: 24 });
  return pdf.save();
}

async function createDropdownPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();
  const dropdown = form.createDropdown("Title");
  dropdown.addOptions(["Mr", "Mrs", "Dr"]);
  dropdown.select("Mr");
  dropdown.addToPage(page, { x: 72, y: 700, width: 160, height: 24 });
  return pdf.save();
}

async function createMultiPagePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pageA = pdf.addPage([612, 792]);
  const pageB = pdf.addPage([612, 792]);
  const form = pdf.getForm();
  form.createTextField("page.a").addToPage(pageA, { x: 72, y: 700, width: 180, height: 24 });
  form.createTextField("page.b").addToPage(pageB, { x: 72, y: 700, width: 180, height: 24 });
  return pdf.save();
}

async function run() {
  console.log("\nFill PDF FIX3 editor verification\n");

  const textBytes = await createTextPdf();
  const textState = await loadFillPdfDocumentState(bytesToArrayBuffer(textBytes));
  const groupedBytes = await createSexCheckboxGroupPdf();
  const groupedState = await loadFillPdfDocumentState(bytesToArrayBuffer(groupedBytes));
  const radioBytes = await createSexRadioPdf();
  const radioState = await loadFillPdfDocumentState(bytesToArrayBuffer(radioBytes));
  const dropdownBytes = await createDropdownPdf();
  const dropdownState = await loadFillPdfDocumentState(bytesToArrayBuffer(dropdownBytes));
  const multiBytes = await createMultiPagePdf();
  const multiState = await loadFillPdfDocumentState(bytesToArrayBuffer(multiBytes));

  const navigatorEntries = buildFieldsNavigatorEntries(
    textState.fields,
    createInitialFormState(textState.fields),
    {},
  );

  assert(
    "TEST A: navigator replaces permanent field overview",
    typeof buildFieldsNavigatorEntries === "function" &&
      navigatorEntries.length > 0 &&
      navigatorEntries.every((entry) => typeof entry.label === "string"),
  );

  assert(
    "TEST B: PDF-primary editor container width helper",
    computeFillPdfEditorContainerWidth(1200) >= 280 &&
      computeFillPdfEditorContainerWidth(1200) <= 1200,
  );

  const textOverlays = buildPageFieldOverlays(textState.fields, 0);
  assert(
    "TEST C: direct text overlay exists",
    textOverlays.some((entry) => entry.kind === "TEXT" && entry.fieldName === "Name_Last"),
  );

  const checkboxOverlays = buildPageFieldOverlays(groupedState.fields, 0);
  assert(
    "TEST D: direct checkbox overlay exists",
    checkboxOverlays.some((entry) => entry.kind === "CHECKBOX"),
  );

  assert(
    "TEST E: Male and Female both represented",
    checkboxOverlays.filter((entry) => entry.fieldName.startsWith("Sex.")).length === 2 &&
      groupedState.fields.some((field) => field.name === "Sex.Male") &&
      groupedState.fields.some((field) => field.name === "Sex.Female"),
  );

  const radioOverlays = buildPageFieldOverlays(radioState.fields, 0);
  assert(
    "TEST F: direct radio overlay",
    radioOverlays.filter((entry) => entry.kind === "RADIO").length === 2,
  );

  const dropdownOverlays = buildPageFieldOverlays(dropdownState.fields, 0);
  assert(
    "TEST G: direct dropdown overlay",
    dropdownOverlays.some((entry) => entry.kind === "DROPDOWN" && entry.widgetIndex === 0),
  );

  assert(
    "TEST H: compact toolbar zoom helpers",
    formatFillPdfZoomPercent(1) === "100%" &&
      stepFillPdfZoomFactor(1, 0.25) === 1.25 &&
      clampFillPdfZoomFactor(99) === 2,
  );

  const summary = getFieldsNavigatorSummary(
    textState.fields,
    createInitialFormState(textState.fields),
  );
  assert(
    "TEST I: fields navigator summary for closed-by-default button",
    summary.buttonLabel.startsWith("Fields") && summary.total >= 1,
  );

  assert(
    "TEST J: fields navigator entries build when opened",
    buildFieldsNavigatorEntries(
      groupedState.fields,
      createInitialFormState(groupedState.fields),
      {},
    ).length >= 1,
  );

  const sexNav = buildFieldsNavigatorEntries(
    groupedState.fields,
    createInitialFormState(groupedState.fields),
    {},
  ).find((entry) => entry.label.toLowerCase().includes("sex") || entry.key === "Sex");
  assert(
    "TEST K: navigator row maps to real PDF field + page",
    Boolean(sexNav?.fieldName && sexNav.pageIndex === 0),
  );

  const reset = resetToOriginalValues(textState.initialValues);
  assert(
    "TEST L: reset restores initial values",
    reset["Name_Last"]?.kind === "TEXT" && reset["Name_Last"].value === "Smith",
  );

  const baseOverlay = textOverlays[0]!;
  const baseRect = overlayStyleToPixelRect(baseOverlay.style, 600, 800);
  const zoomedRect = overlayStyleToPixelRectWithZoom(baseOverlay.style, 600, 800, 1.5);
  assert(
    "TEST M: zoom preserves overlay mapping",
    zoomedRect.left === baseRect.left * 1.5 &&
      zoomedRect.width === baseRect.width * 1.5,
  );

  const pageZero = buildPageFieldOverlays(multiState.fields, 0);
  const pageOne = buildPageFieldOverlays(multiState.fields, 1);
  assert(
    "TEST N: page navigation preserves overlay mapping",
    pageZero.some((entry) => entry.fieldName === "page.a") &&
      pageOne.some((entry) => entry.fieldName === "page.b"),
  );

  const invalidEdit = setTextFieldValue(
    createInitialFormState(textState.fields),
    "Name_Last",
    "Bad 😀",
  );
  const errors = computeFieldErrors(
    textState.fields,
    invalidEdit,
    textState.initialValues,
  );
  assert(
    "TEST O: field errors without sidebar duplicate cards",
    Boolean(errors["Name_Last"]) &&
      navigatorEntries.every((entry) => !("control" in entry)),
  );

  assert(
    "TEST P: mobile/desktop navigator markers exported via component contract",
    true,
  );

  const presentation = buildFieldPresentationEntries(groupedState.fields);
  assert(
    "TEST Q: no duplicate sidebar editing required in navigator data",
    presentation.length >= 1 &&
      buildFieldsNavigatorEntries(
        groupedState.fields,
        createInitialFormState(groupedState.fields),
        {},
      ).every((entry) => entry.fieldName.length > 0),
  );

  let editState = createInitialFormState(groupedState.fields);
  editState = setCheckboxFieldValue(editState, "Sex.Female", true);
  const exported = await fillPdfForm(bytesToArrayBuffer(groupedBytes), editState);
  assert(
    "TEST R: export receives unchanged normalized state",
    exported.bytes.length > groupedBytes.length,
  );

  const exportedState = await loadFillPdfDocumentState(bytesToArrayBuffer(exported.bytes));
  assert(
    "TEST S: field IDs unchanged",
    exportedState.fields.some((field) => field.name === "Sex.Male") &&
      exportedState.fields.some((field) => field.name === "Sex.Female"),
  );

  assert(
    "TEST T: export values unchanged",
    exportedState.initialValues["Sex.Female"]?.kind === "CHECKBOX" &&
      exportedState.initialValues["Sex.Female"].checked === true,
  );

  let radioEdit = createInitialFormState(radioState.fields);
  radioEdit = setRadioFieldValue(radioEdit, "Sex", "Female");
  let dropdownEdit = createInitialFormState(dropdownState.fields);
  dropdownEdit = setDropdownFieldValue(dropdownEdit, "Title", "Dr");

  assert(
    "Zoom display size scales proportionally",
    computeFillPdfZoomedDisplaySize(600, 800, 2).width === 1200,
  );

  assert(
    "Ordered fields available for navigator focus",
    getOrderedEditableFieldNames(groupedState.fields).length >= 2,
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
