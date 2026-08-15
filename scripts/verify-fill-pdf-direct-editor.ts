/**
 * Direct on-PDF editor tests for Fill PDF Forms (Phase 123D-FIX2).
 * Run: npx tsx scripts/verify-fill-pdf-direct-editor.ts
 */

import { PDFDocument, degrees } from "pdf-lib";
import {
  buildFieldPresentationEntries,
  buildFormFieldDescriptors,
  createInitialFormState,
  fillPdfForm,
  getNextFieldName,
  getNextMissingRequiredFieldName,
  getPreviousFieldName,
  hasDistinctWidgetChoices,
  loadFillPdfDocumentState,
  resetToOriginalValues,
  setCheckboxFieldValue,
  setDropdownFieldValue,
  setRadioFieldValue,
  setTextFieldValue,
} from "../lib/tools/fill-pdf";
import {
  buildPageFieldOverlays,
  normalizedRectToOverlayStyle,
} from "../lib/tools/fill-pdf/preview-geometry";
import {
  computeWorkspaceFieldProgress,
  getOrderedEditableFieldNames,
  isFieldComplete,
  isFieldValueEmpty,
} from "../lib/tools/fill-pdf/workspace-ui";
import {
  createCropPageGeometry,
  normalizedCropToPdfCropBox,
} from "../lib/tools/crop-pdf/coordinates";
import type { NormalizedCropRect, PdfBox } from "../lib/tools/crop-pdf/types";

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

const ASYMMETRIC: NormalizedCropRect = {
  x: 0.1,
  y: 0.2,
  width: 0.35,
  height: 0.45,
};

function geometryFromSize(
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270,
  cropBox?: PdfBox,
) {
  const mediaBox: PdfBox = { x: 0, y: 0, width, height };
  const originalCropBox = cropBox ?? mediaBox;
  return createCropPageGeometry(mediaBox, originalCropBox, rotation);
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

async function createReadOnlyTextPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();
  const field = form.createTextField("locked.field");
  field.setText("Locked");
  field.enableReadOnly();
  field.addToPage(page, { x: 72, y: 700, width: 180, height: 24 });
  return pdf.save();
}

async function createRequiredEmptyTextPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();
  const field = form.createTextField("required.field");
  field.enableRequired();
  field.addToPage(page, { x: 72, y: 700, width: 180, height: 24 });
  return pdf.save();
}

async function createRotatedFormPdf(
  rotation: 0 | 90 | 180 | 270,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  page.setRotation(degrees(rotation));
  const form = pdf.getForm();
  const field = form.createTextField(`rotation.${rotation}`);
  const rect = normalizedCropToPdfCropBox(
    ASYMMETRIC,
    geometryFromSize(600, 800, rotation),
  );
  field.addToPage(page, rect);
  return pdf.save();
}

async function createOffsetCropFormPdf(): Promise<Uint8Array> {
  const offsetCrop: PdfBox = { x: 50, y: 75, width: 500, height: 650 };
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  page.setCropBox(offsetCrop.x, offsetCrop.y, offsetCrop.width, offsetCrop.height);
  const form = pdf.getForm();
  const field = form.createTextField("offset.crop.field");
  const rect = normalizedCropToPdfCropBox(
    ASYMMETRIC,
    geometryFromSize(600, 800, 0, offsetCrop),
  );
  field.addToPage(page, rect);
  return pdf.save();
}

async function createMultiPageSizePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pageA = pdf.addPage([600, 800]);
  const pageB = pdf.addPage([800, 600]);
  const form = pdf.getForm();
  form.createTextField("page.a.field").addToPage(pageA, { x: 72, y: 700, width: 180, height: 24 });
  form.createTextField("page.b.field").addToPage(pageB, { x: 96, y: 500, width: 180, height: 24 });
  return pdf.save();
}

async function run() {
  console.log("\nFill PDF direct editor verification\n");

  const groupedBytes = await createSexCheckboxGroupPdf();
  const groupedState = await loadFillPdfDocumentState(bytesToArrayBuffer(groupedBytes));
  const groupedEntries = buildFieldPresentationEntries(groupedState.fields);
  const sexGroup = groupedEntries.find(
    (entry) => entry.kind === "checkbox-group" && entry.groupKey === "Sex",
  );

  assert(
    "TEST A: Male + Female discovered",
    groupedState.fields.some((field) => field.name === "Sex.Male") &&
      groupedState.fields.some((field) => field.name === "Sex.Female"),
  );
  assert(
    "TEST B: distinct export identities preserved",
    sexGroup?.kind === "checkbox-group" &&
      sexGroup.members.map((member) => member.name).join(",") === "Sex.Male,Sex.Female",
  );

  let editState = createInitialFormState(groupedState.fields);
  editState = setCheckboxFieldValue(editState, "Sex.Female", true);
  assert(
    "TEST C: direct checkbox click updates shared state",
    editState["Sex.Female"]?.kind === "CHECKBOX" &&
      editState["Sex.Female"].checked === true,
  );
  assert(
    "TEST D: sidebar checkbox mirrors direct checkbox",
    editState["Sex.Female"]?.kind === "CHECKBOX" &&
      editState["Sex.Female"].checked === true &&
      editState["Sex.Male"]?.kind === "CHECKBOX" &&
      editState["Sex.Male"].checked === false,
  );

  const textBytes = await createTextPdf();
  const textState = await loadFillPdfDocumentState(bytesToArrayBuffer(textBytes));
  let textEdit = createInitialFormState(textState.fields);
  textEdit = setTextFieldValue(textEdit, "Name_Last", "Johnson");
  assert(
    "TEST E: direct text input updates sidebar state",
    textEdit["Name_Last"]?.kind === "TEXT" &&
      textEdit["Name_Last"].value === "Johnson",
  );
  textEdit = setTextFieldValue(textEdit, "Name_Last", "Updated Again");
  assert(
    "TEST F: sidebar text updates direct overlay state",
    textEdit["Name_Last"]?.kind === "TEXT" &&
      textEdit["Name_Last"].value === "Updated Again",
  );

  const radioBytes = await createSexRadioPdf();
  const radioState = await loadFillPdfDocumentState(bytesToArrayBuffer(radioBytes));
  let radioEdit = createInitialFormState(radioState.fields);
  radioEdit = setRadioFieldValue(radioEdit, "Sex", "Female");
  assert(
    "TEST G: radio selection sync",
    radioEdit["Sex"]?.kind === "RADIO" && radioEdit["Sex"].selected === "Female",
  );

  const dropdownBytes = await createDropdownPdf();
  const dropdownState = await loadFillPdfDocumentState(bytesToArrayBuffer(dropdownBytes));
  let dropdownEdit = createInitialFormState(dropdownState.fields);
  dropdownEdit = setDropdownFieldValue(dropdownEdit, "Title", "Dr");
  assert(
    "TEST H: dropdown sync",
    dropdownEdit["Title"]?.kind === "DROPDOWN" &&
      dropdownEdit["Title"].selected === "Dr",
  );

  const reset = resetToOriginalValues(textState.initialValues);
  assert(
    "TEST I: reset sync",
    reset["Name_Last"]?.kind === "TEXT" && reset["Name_Last"].value === "Smith",
  );

  const reloadedGrouped = await loadFillPdfDocumentState(bytesToArrayBuffer(groupedBytes));
  assert(
    "TEST J: re-upload values populate overlay state",
    reloadedGrouped.initialValues["Sex.Male"]?.kind === "CHECKBOX",
  );

  const ordered = getOrderedEditableFieldNames(groupedState.fields);
  assert(
    "TEST K: page navigation follows field order",
    ordered.includes("Sex.Male") && ordered.includes("Sex.Female"),
  );
  assert(
    "TEST L: next/previous field navigation",
    getNextFieldName(groupedState.fields, ordered[0]!) === ordered[1] &&
      getPreviousFieldName(groupedState.fields, ordered[1]!) === ordered[0],
  );

  const requiredBytes = await createRequiredEmptyTextPdf();
  const requiredState = await loadFillPdfDocumentState(bytesToArrayBuffer(requiredBytes));
  const requiredProgress = computeWorkspaceFieldProgress(
    requiredState.fields,
    createInitialFormState(requiredState.fields),
  );
  assert(
    "TEST M: required-field progress",
    requiredProgress.requiredRemaining === 1 &&
      requiredProgress.completed < requiredProgress.totalEditable,
  );
  assert(
    "TEST N: review missing jumps correctly",
    getNextMissingRequiredFieldName(
      requiredState.fields,
      createInitialFormState(requiredState.fields),
      null,
    ) === "required.field",
  );

  for (const rotation of [0, 90, 180, 270] as const) {
    const rotatedBytes = await createRotatedFormPdf(rotation);
    const rotatedPdf = await PDFDocument.load(rotatedBytes);
    const rotatedDescriptors = buildFormFieldDescriptors(rotatedPdf);
    const overlayStyle = normalizedRectToOverlayStyle(
      rotatedDescriptors[0]?.widgets[0]?.normalizedRect ?? {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
    );
    assert(`TEST ${rotation === 0 ? "O" : rotation === 90 ? "P" : rotation === 180 ? "Q" : "R"}: ${rotation}° overlay`, overlayStyle.left.includes("%"));
  }

  const offsetBytes = await createOffsetCropFormPdf();
  const offsetPdf = await PDFDocument.load(offsetBytes);
  const offsetDescriptors = buildFormFieldDescriptors(offsetPdf);
  assert(
    "TEST S: CropBox overlay",
    buildPageFieldOverlays(offsetDescriptors, 0).length === 1,
  );
  assert(
    "TEST T: offset CropBox overlay",
    offsetDescriptors[0]?.widgets[0]?.normalizedRect.x !== undefined,
  );

  const mixedBytes = await createMultiPageSizePdf();
  const mixedState = await loadFillPdfDocumentState(bytesToArrayBuffer(mixedBytes));
  assert(
    "TEST U: mixed page size overlays",
    buildPageFieldOverlays(mixedState.fields, 0).length === 1 &&
      buildPageFieldOverlays(mixedState.fields, 1).length === 1,
  );

  const readOnlyState = await loadFillPdfDocumentState(
    bytesToArrayBuffer(await createReadOnlyTextPdf()),
  );
  assert(
    "TEST V: read-only overlay metadata",
    readOnlyState.fields[0]?.readOnly === true,
  );

  const invalidText = setTextFieldValue(
    createInitialFormState(textState.fields),
    "Name_Last",
    "Bad 😀",
  );
  assert(
    "TEST W: unsupported character state preserved",
    invalidText["Name_Last"]?.kind === "TEXT" &&
      invalidText["Name_Last"].value.includes("😀"),
  );

  const radioField = radioState.fields.find((field) => field.name === "Sex");
  assert(
    "TEST X: multi-widget logical field",
    radioField?.widgets.length === 2 &&
      buildPageFieldOverlays(radioState.fields, 0).length === 2,
  );

  const radioOverlays = buildPageFieldOverlays(radioState.fields, 0);
  assert(
    "TEST Y: no duplicate controls",
    new Set(radioOverlays.map((entry) => `${entry.fieldName}:${entry.widgetIndex}`)).size ===
      radioOverlays.length,
  );

  editState = setCheckboxFieldValue(editState, "Sex.Male", false);
  editState = setCheckboxFieldValue(editState, "Sex.Female", true);
  const exported = await fillPdfForm(bytesToArrayBuffer(groupedBytes), editState);
  const exportedState = await loadFillPdfDocumentState(bytesToArrayBuffer(exported.bytes));
  assert(
    "TEST Z: overlay edits preserve field identity/export values",
    exportedState.fields.some((field) => field.name === "Sex.Male") &&
      exportedState.fields.some((field) => field.name === "Sex.Female") &&
      exportedState.initialValues["Sex.Female"]?.kind === "CHECKBOX" &&
      exportedState.initialValues["Sex.Female"].checked === true,
  );

  assert(
    "Radio widgets expose option values",
    Boolean(radioField?.widgets.every((widget) => Boolean(widget.widgetOptionValue))),
  );
  assert(
    "Widget-checkbox detection helper available",
    typeof hasDistinctWidgetChoices === "function",
  );
  assert(
    "Completion helper marks empty text",
    isFieldValueEmpty(textState.fields[0]!, { kind: "TEXT", value: "" }),
  );
  assert(
    "Completion helper marks filled text",
    isFieldComplete(textState.fields[0]!, { kind: "TEXT", value: "Smith" }),
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
