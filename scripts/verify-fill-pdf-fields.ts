/**
 * Fill PDF field descriptor and edit-state tests (Phase 123B).
 * Run: npx tsx scripts/verify-fill-pdf-fields.ts
 */

import { PDFDocument } from "pdf-lib";
import {
  buildFormFieldDescriptors,
  createInitialFormState,
  loadFillPdfDocumentState,
  resetToOriginalValues,
  setCheckboxFieldValue,
  setDropdownFieldValue,
  setOptionListFieldValue,
  setRadioFieldValue,
  setTextFieldValue,
  validateFieldValue,
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

async function createComprehensiveFormPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();

  const nameField = form.createTextField("person.name");
  nameField.setText("Initial Name");
  nameField.setMaxLength(20);
  nameField.enableRequired();
  nameField.addToPage(page, { x: 72, y: 700, width: 220, height: 24 });

  const notesField = form.createTextField("person.notes");
  notesField.enableMultiline();
  notesField.setText("Line one");
  notesField.addToPage(page, { x: 72, y: 640, width: 220, height: 60 });

  const readonlyField = form.createTextField("person.readonly");
  readonlyField.setText("Locked");
  readonlyField.enableReadOnly();
  readonlyField.addToPage(page, { x: 72, y: 600, width: 220, height: 24 });

  const agreeBox = form.createCheckBox("consent.agree");
  agreeBox.addToPage(page, { x: 72, y: 560, width: 18, height: 18 });

  const planGroup = form.createRadioGroup("plan.choice");
  planGroup.addOptionToPage("basic", page, { x: 72, y: 520, width: 18, height: 18 });
  planGroup.addOptionToPage("pro", page, { x: 120, y: 520, width: 18, height: 18 });
  planGroup.select("basic");

  const countryDropdown = form.createDropdown("address.country");
  countryDropdown.addOptions(["US", "CA", "UK"]);
  countryDropdown.select("US");
  countryDropdown.addToPage(page, { x: 72, y: 480, width: 160, height: 24 });

  const skillsList = form.createOptionList("skills.list");
  skillsList.addOptions(["js", "ts", "py"]);
  skillsList.select(["js", "ts"]);
  skillsList.addToPage(page, { x: 72, y: 380, width: 160, height: 80 });

  return pdf.save();
}

async function expectValidationError(
  name: string,
  run: () => void,
  code: FillPdfError["code"],
) {
  try {
    run();
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
  console.log("\nFill PDF field verification\n");

  const bytes = await createComprehensiveFormPdf();
  const buffer = bytesToArrayBuffer(bytes);
  const state = await loadFillPdfDocumentState(buffer);
  const descriptors = state.fields;
  const descriptorByName = new Map(descriptors.map((field) => [field.name, field]));

  assert("Field count", descriptors.length === 7);

  const nameField = descriptorByName.get("person.name");
  assert("Text field kind", nameField?.kind === "TEXT");
  assert("Text existing value", nameField?.currentValue.kind === "TEXT" && nameField.currentValue.value === "Initial Name");
  assert("Text maxLength", nameField?.maxLength === 20);
  assert("Text required", nameField?.required === true);

  const notesField = descriptorByName.get("person.notes");
  assert("Multiline text", notesField?.multiline === true);

  const readonlyField = descriptorByName.get("person.readonly");
  assert("Read-only text", readonlyField?.readOnly === true);

  const agreeField = descriptorByName.get("consent.agree");
  assert("Checkbox kind", agreeField?.kind === "CHECKBOX");
  assert(
    "Checkbox default",
    agreeField?.currentValue.kind === "CHECKBOX" && agreeField.currentValue.checked === false,
  );

  const planField = descriptorByName.get("plan.choice");
  assert("Radio kind", planField?.kind === "RADIO");
  assert(
    "Radio selected",
    planField?.currentValue.kind === "RADIO" && planField.currentValue.selected === "basic",
  );
  assert("Radio options", planField?.options?.join(",") === "basic,pro");

  const countryField = descriptorByName.get("address.country");
  assert("Dropdown kind", countryField?.kind === "DROPDOWN");
  assert(
    "Dropdown selected",
    countryField?.currentValue.kind === "DROPDOWN" && countryField.currentValue.selected === "US",
  );

  const skillsField = descriptorByName.get("skills.list");
  assert("Option list kind", skillsField?.kind === "OPTION_LIST");
  assert(
    "Option list selected",
    skillsField?.currentValue.kind === "OPTION_LIST" &&
      skillsField.currentValue.selected.join(",") === "js,ts",
  );

  let editState = createInitialFormState(descriptors);
  editState = setTextFieldValue(editState, "person.name", "Updated Name");
  editState = setCheckboxFieldValue(editState, "consent.agree", true);
  editState = setRadioFieldValue(editState, "plan.choice", "pro");
  editState = setDropdownFieldValue(editState, "address.country", "CA");
  editState = setOptionListFieldValue(editState, "skills.list", ["py"]);

  assert(
    "Text change in edit state",
    editState["person.name"].kind === "TEXT" && editState["person.name"].value === "Updated Name",
  );
  assert(
    "Checkbox change in edit state",
    editState["consent.agree"].kind === "CHECKBOX" && editState["consent.agree"].checked === true,
  );

  validateFieldValue(nameField!, editState["person.name"]);
  validateFieldValue(agreeField!, editState["consent.agree"]);

  await expectValidationError(
    "Unsupported characters rejected",
    () =>
      validateFieldValue(nameField!, {
        kind: "TEXT",
        value: "Hello 世界",
      }),
    "UNSUPPORTED_CHARACTERS",
  );

  await expectValidationError(
    "Text too long rejected",
    () =>
      validateFieldValue(nameField!, {
        kind: "TEXT",
        value: "abcdefghijklmnopqrstu",
      }),
    "TEXT_TOO_LONG",
  );

  await expectValidationError(
    "Read-only rejected",
    () =>
      validateFieldValue(readonlyField!, {
        kind: "TEXT",
        value: "Nope",
      }),
    "READ_ONLY_FIELD",
  );

  const reset = resetToOriginalValues(state.initialValues);
  assert(
    "Reset restores original text",
    reset["person.name"].kind === "TEXT" && reset["person.name"].value === "Initial Name",
  );
  assert(
    "Reset restores checkbox",
    reset["consent.agree"].kind === "CHECKBOX" && reset["consent.agree"].checked === false,
  );

  const pdf = await PDFDocument.load(bytes);
  const built = buildFormFieldDescriptors(pdf);
  assert("buildFormFieldDescriptors matches load", built.length === descriptors.length);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
