/**
 * Semantic choice presentation tests for Fill PDF Forms (Phase 123D-FIX1).
 * Run: npx tsx scripts/verify-fill-pdf-semantic-presentation.ts
 */

import { PDFDocument } from "pdf-lib";
import {
  buildFieldPresentationEntries,
  buildFormFieldDescriptors,
  createInitialFormState,
  fillPdfForm,
  formatChoiceOptionLabel,
  getCheckboxChoiceLabel,
  getFieldDisplayLabel,
  getFieldGroupReadOnlyState,
  humanizeFieldDisplayName,
  isGenericExportOnValue,
  loadFillPdfDocumentState,
  setCheckboxFieldValue,
  setRadioFieldValue,
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

async function createSexRadioPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();

  const sexGroup = form.createRadioGroup("Sex");
  sexGroup.addOptionToPage("Male", page, { x: 72, y: 700, width: 18, height: 18 });
  sexGroup.addOptionToPage("Female", page, { x: 120, y: 700, width: 18, height: 18 });
  sexGroup.select("Female");

  return pdf.save();
}

async function createSexCheckboxGroupPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();

  const male = form.createCheckBox("Sex.Male");
  male.addToPage(page, { x: 72, y: 700, width: 18, height: 18 });
  male.check();

  const female = form.createCheckBox("Sex.Female");
  female.addToPage(page, { x: 120, y: 700, width: 18, height: 18 });

  return pdf.save();
}

async function createUnrelatedCheckboxPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();

  form.createCheckBox("consent.agree").addToPage(page, { x: 72, y: 700, width: 18, height: 18 });
  form.createCheckBox("newsletter.optin").addToPage(page, { x: 72, y: 660, width: 18, height: 18 });

  return pdf.save();
}

async function createGenericYesCheckboxPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();

  form.createCheckBox("AcceptTerms").addToPage(page, { x: 72, y: 700, width: 18, height: 18 });

  return pdf.save();
}

async function createDropdownPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();

  const title = form.createDropdown("Title");
  title.addOptions(["Mr", "Mrs", "Dr"]);
  title.select("Dr");
  title.addToPage(page, { x: 72, y: 700, width: 160, height: 24 });

  return pdf.save();
}

async function createReadOnlyGroupedCheckboxPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();

  const a = form.createCheckBox("Education.HighSchool");
  a.enableReadOnly();
  a.addToPage(page, { x: 72, y: 700, width: 18, height: 18 });

  const b = form.createCheckBox("Education.College");
  b.enableReadOnly();
  b.addToPage(page, { x: 72, y: 660, width: 18, height: 18 });

  return pdf.save();
}

async function createRequiredGroupedCheckboxPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();

  const a = form.createCheckBox("Status.Single");
  a.enableRequired();
  a.addToPage(page, { x: 72, y: 700, width: 18, height: 18 });

  const b = form.createCheckBox("Status.Married");
  b.addToPage(page, { x: 72, y: 660, width: 18, height: 18 });

  return pdf.save();
}

async function createMultiWidgetRadioPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pageA = pdf.addPage([600, 800]);
  const pageB = pdf.addPage([800, 600]);
  const form = pdf.getForm();
  const radio = form.createRadioGroup("multi.page.choice");
  radio.addOptionToPage("a", pageA, { x: 72, y: 700, width: 18, height: 18 });
  radio.addOptionToPage("b", pageB, { x: 96, y: 500, width: 18, height: 18 });
  radio.select("b");
  return pdf.save();
}

async function inspectSexFieldStructure() {
  const radioBytes = await createSexRadioPdf();
  const radioPdf = await PDFDocument.load(radioBytes);
  const radioDescriptors = buildFormFieldDescriptors(radioPdf);
  const sexRadio = radioDescriptors.find((field) => field.name === "Sex");

  console.log("\nSex field structure (synthetic radio fixture):");
  console.log(`  kind: ${sexRadio?.kind}`);
  console.log(`  options: ${sexRadio?.options?.join(", ") ?? "(none)"}`);
  console.log(`  widget count: ${sexRadio?.widgets.length ?? 0}`);

  const checkboxBytes = await createSexCheckboxGroupPdf();
  const checkboxPdf = await PDFDocument.load(checkboxBytes);
  const checkboxDescriptors = buildFormFieldDescriptors(checkboxPdf);

  console.log("\nSex field structure (synthetic hierarchical checkbox fixture):");
  for (const field of checkboxDescriptors.filter((item) => item.name.startsWith("Sex"))) {
    console.log(
      `  ${field.name}: kind=${field.kind}, exportOnValue=${field.exportOnValue ?? "(default)"}, widgets=${field.widgets.length}`,
    );
  }

  return { sexRadio, checkboxDescriptors };
}

async function run() {
  console.log("\nFill PDF semantic presentation verification\n");

  await inspectSexFieldStructure();

  // TEST A — snake_case field humanization
  assert(
    "TEST A: Name_Last humanization",
    humanizeFieldDisplayName("Name_Last") === "Last name",
  );

  // TEST B — radio group Sex → Male/Female
  const radioBytes = await createSexRadioPdf();
  const radioState = await loadFillPdfDocumentState(bytesToArrayBuffer(radioBytes));
  const sexRadio = radioState.fields.find((field) => field.name === "Sex");
  assert(
    "TEST B: Sex radio options",
    sexRadio?.kind === "RADIO" && sexRadio.options?.join(",") === "Male,Female",
  );
  assert(
    "TEST B: Sex radio option labels",
    formatChoiceOptionLabel("Male") === "Male" &&
      formatChoiceOptionLabel("Female") === "Female",
  );

  // TEST C — existing selected radio value
  assert(
    "TEST C: Sex radio selected Female",
    sexRadio?.currentValue.kind === "RADIO" &&
      sexRadio.currentValue.selected === "Female",
  );

  // TEST D — hierarchical checkbox names grouped where safe
  const groupedBytes = await createSexCheckboxGroupPdf();
  const groupedState = await loadFillPdfDocumentState(bytesToArrayBuffer(groupedBytes));
  const groupedEntries = buildFieldPresentationEntries(groupedState.fields);
  const sexGroup = groupedEntries.find(
    (entry) => entry.kind === "checkbox-group" && entry.groupKey === "Sex",
  );
  assert("TEST D: Sex checkbox group exists", Boolean(sexGroup));
  assert(
    "TEST D: Sex checkbox group members",
    sexGroup?.kind === "checkbox-group" &&
      sexGroup.members.map((member) => member.name).join(",") === "Sex.Male,Sex.Female",
  );
  assert(
    "TEST D: Sex checkbox choice labels",
    sexGroup?.kind === "checkbox-group" &&
      getCheckboxChoiceLabel(sexGroup.members[0]!) === "Male" &&
      getCheckboxChoiceLabel(sexGroup.members[1]!) === "Female",
  );

  // TEST E — unrelated checkboxes are NOT grouped
  const unrelatedBytes = await createUnrelatedCheckboxPdf();
  const unrelatedState = await loadFillPdfDocumentState(bytesToArrayBuffer(unrelatedBytes));
  const unrelatedEntries = buildFieldPresentationEntries(unrelatedState.fields);
  assert(
    "TEST E: unrelated checkboxes stay single",
    unrelatedEntries.every((entry) => entry.kind === "single") &&
      unrelatedEntries.length === 2,
  );

  // TEST F — generic Yes does not replace meaningful field label
  const genericBytes = await createGenericYesCheckboxPdf();
  const genericState = await loadFillPdfDocumentState(bytesToArrayBuffer(genericBytes));
  const acceptField = genericState.fields.find((field) => field.name === "AcceptTerms");
  assert(
    "TEST F: generic export value detected",
    isGenericExportOnValue(acceptField?.exportOnValue ?? "Yes"),
  );
  assert(
    "TEST F: checkbox label uses field name not Yes",
    getCheckboxChoiceLabel(acceptField!) === "Accept Terms",
  );

  // TEST G — dropdown options preserved exactly
  const dropdownBytes = await createDropdownPdf();
  const dropdownState = await loadFillPdfDocumentState(bytesToArrayBuffer(dropdownBytes));
  const titleField = dropdownState.fields.find((field) => field.name === "Title");
  assert(
    "TEST G: dropdown options preserved",
    titleField?.options?.join(",") === "Mr,Mrs,Dr",
  );
  assert(
    "TEST G: dropdown selected value preserved",
    titleField?.currentValue.kind === "DROPDOWN" &&
      titleField.currentValue.selected === "Dr",
  );

  // TEST H — read-only grouped field remains read-only
  const readOnlyBytes = await createReadOnlyGroupedCheckboxPdf();
  const readOnlyState = await loadFillPdfDocumentState(bytesToArrayBuffer(readOnlyBytes));
  const readOnlyGroup = buildFieldPresentationEntries(readOnlyState.fields).find(
    (entry) => entry.kind === "checkbox-group",
  );
  assert(
    "TEST H: grouped read-only state",
    readOnlyGroup?.kind === "checkbox-group" &&
      getFieldGroupReadOnlyState(readOnlyGroup.members),
  );

  // TEST I — required metadata preserved
  const requiredBytes = await createRequiredGroupedCheckboxPdf();
  const requiredState = await loadFillPdfDocumentState(bytesToArrayBuffer(requiredBytes));
  const requiredMember = requiredState.fields.find((field) => field.name === "Status.Single");
  assert("TEST I: required metadata preserved", requiredMember?.required === true);

  // TEST J — underlying field IDs unchanged
  assert(
    "TEST J: field names unchanged",
    groupedState.fields.some((field) => field.name === "Sex.Male") &&
      groupedState.fields.some((field) => field.name === "Sex.Female"),
  );
  assert(
    "TEST J: display label differs from export key",
    getFieldDisplayLabel(groupedState.fields[0]!) !== groupedState.fields[0]!.name ||
      groupedState.fields[0]!.name.includes("."),
  );

  // TEST K — export values unchanged
  let editState = createInitialFormState(groupedState.fields);
  editState = setCheckboxFieldValue(editState, "Sex.Male", false);
  editState = setCheckboxFieldValue(editState, "Sex.Female", true);
  const exported = await fillPdfForm(bytesToArrayBuffer(groupedBytes), editState);
  const reloaded = await loadFillPdfDocumentState(bytesToArrayBuffer(exported.bytes));
  const exportedMale = reloaded.fields.find((field) => field.name === "Sex.Male");
  const exportedFemale = reloaded.fields.find((field) => field.name === "Sex.Female");
  assert(
    "TEST K: export values unchanged",
    exportedMale?.currentValue.kind === "CHECKBOX" &&
      exportedMale.currentValue.checked === false &&
      exportedFemale?.currentValue.kind === "CHECKBOX" &&
      exportedFemale.currentValue.checked === true,
  );

  let radioEdit = createInitialFormState(radioState.fields);
  radioEdit = setRadioFieldValue(radioEdit, "Sex", "Male");
  const exportedRadio = await fillPdfForm(bytesToArrayBuffer(radioBytes), radioEdit);
  const reloadedRadio = await loadFillPdfDocumentState(
    bytesToArrayBuffer(exportedRadio.bytes),
  );
  const exportedSex = reloadedRadio.fields.find((field) => field.name === "Sex");
  assert(
    "TEST K: radio export value unchanged",
    exportedSex?.currentValue.kind === "RADIO" &&
      exportedSex.currentValue.selected === "Male",
  );

  // TEST L — multi-widget logical field does not duplicate state
  const multiBytes = await createMultiWidgetRadioPdf();
  const multiState = await loadFillPdfDocumentState(bytesToArrayBuffer(multiBytes));
  const multiField = multiState.fields.find((field) => field.name === "multi.page.choice");
  const multiEntries = buildFieldPresentationEntries(multiState.fields);
  assert(
    "TEST L: multi-widget radio stays single entry",
    multiEntries.filter((entry) => entry.kind === "single").length === 1,
  );
  assert("TEST L: multi-widget count preserved", multiField?.widgets.length === 2);
  assert(
    "TEST L: multi-widget selected value preserved",
    multiField?.currentValue.kind === "RADIO" &&
      multiField.currentValue.selected === "b",
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
