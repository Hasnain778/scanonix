/**
 * Invalid field value diagnostic tests for Fill PDF Forms (Phase 123D-FIX5).
 * Run: npx tsx scripts/verify-fill-pdf-invalid-value.ts
 */

import {
  PDFDocument,
  PDFHexString,
  PDFName,
  degrees,
  rgb,
} from "pdf-lib";
import {
  buildInitialTextFormatState,
  cloneTextFormatState,
  computeFieldErrors,
  createInitialFormState,
  fieldValuesEqual,
  fillPdfForm,
  FillPdfError,
  formatChoiceOptionLabel,
  hasDistinctWidgetChoices,
  loadFillPdfDocumentState,
  mapEngineErrorToMessage,
  mapValidationErrorToMessage,
  resetWorkspaceFormValues,
  sanitizeUserFacingError,
  setCheckboxFieldValue,
  setDropdownFieldValue,
  setRadioFieldValue,
  setTextFieldValue,
  updateSelectedTextFormatState,
} from "../lib/tools/fill-pdf";
import { buildInitialWorkspaceState } from "../lib/tools/fill-pdf/workspace-ui";

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
  return bytes.slice().buffer as ArrayBuffer;
}

type CheckBoxInternals = {
  createWidget: (options: Record<string, unknown>) => {
    dict: unknown;
    setAppearanceState: (state: PDFName) => void;
  };
  updateWidgetAppearance: (widget: unknown, onValue: PDFName) => void;
};

async function createInteractiveFormFixturePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();

  const lastName = form.createTextField("Name_Last");
  lastName.setText("Smith");
  lastName.addToPage(page, { x: 72, y: 720, width: 200, height: 24 });

  const male = form.createCheckBox("Sex.Male");
  male.addToPage(page, { x: 72, y: 680, width: 18, height: 18 });

  const female = form.createCheckBox("Sex.Female");
  female.addToPage(page, { x: 120, y: 680, width: 18, height: 18 });

  const sexMulti = form.createCheckBox("Gender");
  sexMulti.addToPage(page, { x: 72, y: 640, width: 18, height: 18 });
  const sexInternal = sexMulti as unknown as CheckBoxInternals;
  const femaleWidget = sexInternal.createWidget({
    x: 120,
    y: 640,
    width: 18,
    height: 18,
    textColor: rgb(0, 0, 0),
    backgroundColor: rgb(1, 1, 1),
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
    rotate: degrees(0),
    page: page.ref,
  });
  const femaleWidgetRef = pdf.context.register(femaleWidget.dict as never);
  const femaleApState = sexMulti.acroField.addWidgetWithOpt(
    femaleWidgetRef,
    PDFHexString.fromText("Female"),
    true,
  );
  femaleWidget.setAppearanceState(PDFName.of("Off"));
  sexInternal.updateWidgetAppearance(femaleWidget, femaleApState);
  page.node.addAnnot(femaleWidgetRef);

  const highSchool = form.createCheckBox("Education.HighSchool");
  highSchool.addToPage(page, { x: 72, y: 600, width: 18, height: 18 });

  const college = form.createCheckBox("Education.College");
  college.addToPage(page, { x: 72, y: 560, width: 18, height: 18 });

  const graduate = form.createCheckBox("Education.Graduate");
  graduate.addToPage(page, { x: 72, y: 520, width: 18, height: 18 });

  const title = form.createDropdown("Title");
  title.addOptions(["Mr", "Mrs", "Dr"]);
  title.select("Mr");
  title.addToPage(page, { x: 72, y: 480, width: 160, height: 24 });

  const plan = form.createRadioGroup("Plan");
  plan.addOptionToPage("basic", page, { x: 72, y: 440, width: 18, height: 18 });
  plan.addOptionToPage("pro", page, { x: 120, y: 440, width: 18, height: 18 });

  return pdf.save();
}

async function run() {
  console.log("\nFill PDF invalid value verification (FIX5)\n");

  const fixtureBytes = await createInteractiveFormFixturePdf();
  const fixtureBuffer = bytesToArrayBuffer(fixtureBytes);

  let loadError: unknown;
  const loaded = await loadFillPdfDocumentState(fixtureBuffer).catch((error) => {
    loadError = error;
    return null;
  });

  assert("TEST A: fixture loads without invalid-value error", loaded !== null);
  if (!loaded) {
    console.error(loadError);
    process.exit(1);
  }

  const sexMulti = loaded.fields.find((field) => field.name === "Gender");
  const femaleExport = sexMulti?.widgets[1]?.widgetExportValue;

  assert(
    "TEST B: Male widget legal value discovered",
    loaded.fields.some((field) => field.name === "Sex.Male"),
  );
  assert(
    "TEST C: Female widget legal value discovered",
    loaded.fields.some((field) => field.name === "Sex.Female"),
  );
  assert(
    "TEST D: multi-widget checkbox detected",
    Boolean(sexMulti && hasDistinctWidgetChoices(sexMulti)),
  );

  let edits = createInitialFormState(loaded.fields);
  if (femaleExport) {
    edits = setCheckboxFieldValue(edits, "Gender", true, femaleExport);
  }

  let multiToggleError: unknown;
  try {
    await fillPdfForm(fixtureBuffer, edits);
    assert("TEST D: multi-widget checkbox toggle exports", true);
  } catch (error) {
    multiToggleError = error;
    assert("TEST D: multi-widget checkbox toggle exports", false, String(error));
  }

  edits = setCheckboxFieldValue(edits, "Education.College", true);
  edits = setCheckboxFieldValue(edits, "Education.HighSchool", true);
  try {
    await fillPdfForm(fixtureBuffer, edits);
    assert("TEST E: Education checkbox toggle exports", true);
  } catch (error) {
    assert("TEST E: Education checkbox toggle exports", false, String(error));
  }

  edits = setCheckboxFieldValue(createInitialFormState(loaded.fields), "Sex.Female", true);
  try {
    const femaleOnly = await fillPdfForm(fixtureBuffer, edits);
    const reloadedFemale = await loadFillPdfDocumentState(
      bytesToArrayBuffer(femaleOnly.bytes),
    );
    const femaleValue = reloadedFemale.initialValues["Sex.Female"];
    assert(
      "TEST F: unchecked/check states round-trip",
      femaleValue?.kind === "CHECKBOX" && femaleValue.checked === true,
    );
  } catch (error) {
    assert("TEST F: unchecked/check states round-trip", false, String(error));
  }

  edits = setRadioFieldValue(createInitialFormState(loaded.fields), "Plan", "pro");
  try {
    const radioExport = await fillPdfForm(fixtureBuffer, edits);
    const radioReload = await loadFillPdfDocumentState(
      bytesToArrayBuffer(radioExport.bytes),
    );
    const plan = radioReload.initialValues["Plan"];
    assert(
      "TEST G: radio exact option mapping",
      plan?.kind === "RADIO" && plan.selected === "pro",
    );
  } catch (error) {
    assert("TEST G: radio exact option mapping", false, String(error));
  }

  edits = setDropdownFieldValue(createInitialFormState(loaded.fields), "Title", "Dr");
  try {
    const dropdownExport = await fillPdfForm(fixtureBuffer, edits);
    const dropdownReload = await loadFillPdfDocumentState(
      bytesToArrayBuffer(dropdownExport.bytes),
    );
    const title = dropdownReload.initialValues["Title"];
    assert(
      "TEST H: dropdown exact option mapping",
      title?.kind === "DROPDOWN" && title.selected === "Dr",
    );
  } catch (error) {
    assert("TEST H: dropdown exact option mapping", false, String(error));
  }

  const labelOnlyEdit = setCheckboxFieldValue(
    createInitialFormState(loaded.fields),
    "Gender",
    true,
    formatChoiceOptionLabel("Female"),
  );
  const labelErrors = computeFieldErrors(
    loaded.fields,
    labelOnlyEdit,
    loaded.initialValues,
  );
  assert(
    "TEST I: humanized label never replaces export value",
    Boolean(labelErrors["Gender"]) &&
      !Object.values(labelErrors).some((message) =>
        /attempted to set invalid field value/i.test(message),
      ),
  );

  const workspace = buildInitialWorkspaceState(loaded.fields, loaded.initialValues);
  const formatted = updateSelectedTextFormatState(workspace, { bold: true });
  assert(
    "TEST J: formatting state never enters value setter",
    formatted.textFormatState !== workspace.textFormatState &&
      fieldValuesEqual(
        formatted.editState["Name_Last"]!,
        workspace.editState["Name_Last"]!,
      ),
  );

  const autoFormat = cloneTextFormatState(buildInitialTextFormatState(loaded.fields));
  autoFormat["Name_Last"] = {
    fontSize: "auto",
    bold: false,
    italic: false,
    underline: false,
  };
  const autoEdits = setTextFieldValue(
    createInitialFormState(loaded.fields),
    "Name_Last",
    "AutoSize",
  );
  try {
    await fillPdfForm(fixtureBuffer, autoEdits, { textFormatState: autoFormat });
    assert("TEST K: Auto size does not modify value", true);
  } catch (error) {
    assert("TEST K: Auto size does not modify value", false, String(error));
  }

  const boldFormat = cloneTextFormatState(autoFormat);
  boldFormat["Name_Last"] = {
    fontSize: 12,
    bold: true,
    italic: false,
    underline: false,
  };
  try {
    const boldExport = await fillPdfForm(fixtureBuffer, autoEdits, {
      textFormatState: boldFormat,
    });
    const boldReload = await loadFillPdfDocumentState(
      bytesToArrayBuffer(boldExport.bytes),
    );
    assert(
      "TEST L: Bold does not modify value",
      boldReload.initialValues["Name_Last"]?.kind === "TEXT" &&
        boldReload.initialValues["Name_Last"].value === "AutoSize",
    );
  } catch (error) {
    assert("TEST L: Bold does not modify value", false, String(error));
  }

  const italicFormat = cloneTextFormatState(boldFormat);
  italicFormat["Name_Last"] = {
    fontSize: 12,
    bold: false,
    italic: true,
    underline: false,
  };
  try {
    const italicExport = await fillPdfForm(fixtureBuffer, autoEdits, {
      textFormatState: italicFormat,
    });
    const italicReload = await loadFillPdfDocumentState(
      bytesToArrayBuffer(italicExport.bytes),
    );
    assert(
      "TEST M: Italic does not modify value",
      italicReload.initialValues["Name_Last"]?.kind === "TEXT" &&
        italicReload.initialValues["Name_Last"].value === "AutoSize",
    );
  } catch (error) {
    assert("TEST M: Italic does not modify value", false, String(error));
  }

  const reset = resetWorkspaceFormValues(
    workspace.initialValues,
    workspace.initialTextFormatState,
  );
  const resetErrors = computeFieldErrors(
    loaded.fields,
    reset.editState,
    loaded.initialValues,
  );
  assert(
    "TEST N: reset produces only legal values",
    Object.keys(resetErrors).length === 0 &&
      JSON.stringify(reset.textFormatState) ===
        JSON.stringify(workspace.initialTextFormatState),
  );

  edits = setCheckboxFieldValue(createInitialFormState(loaded.fields), "Sex.Female", true);
  edits = setCheckboxFieldValue(edits, "Education.Graduate", true);
  edits = setTextFieldValue(edits, "Name_Last", "Exported");
  let exportBytes: Uint8Array | null = null;
  try {
    const exported = await fillPdfForm(fixtureBuffer, edits, {
      textFormatState: boldFormat,
    });
    exportBytes = exported.bytes;
    assert("TEST O: export produces only legal values", exportBytes.byteLength > 0);
  } catch (error) {
    assert("TEST O: export produces only legal values", false, String(error));
  }

  if (exportBytes) {
    try {
      await loadFillPdfDocumentState(bytesToArrayBuffer(exportBytes));
      assert("TEST P: re-upload has no invalid-value error", true);
    } catch (error) {
      assert("TEST P: re-upload has no invalid-value error", false, String(error));
    }
  } else {
    assert("TEST P: re-upload has no invalid-value error", false, "missing export bytes");
  }

  const sanitized = sanitizeUserFacingError("Attempted to set invalid field value");
  const mapped = mapEngineErrorToMessage(
    "INVALID_FIELD_VALUE",
    "Attempted to set invalid field value",
  );
  assert(
    "TEST Q: raw engine exception is not exposed as normal user-facing copy",
    sanitized === "That value isn't supported by this PDF field." &&
      mapped === "That value isn't supported by this PDF field." &&
      !/attempted to set invalid field value/i.test(mapped),
  );

  if (femaleExport && sexMulti) {
    const legalEdit = setCheckboxFieldValue(
      createInitialFormState(loaded.fields),
      "Gender",
      true,
      femaleExport,
    );
    try {
      const legalExport = await fillPdfForm(fixtureBuffer, legalEdit);
      const legalReload = await loadFillPdfDocumentState(
        bytesToArrayBuffer(legalExport.bytes),
      );
      const legalGender = legalReload.fields.find((field) => field.name === "Gender");
      assert(
        "multi-widget female export preserves selected export value",
        legalGender?.currentValue.kind === "CHECKBOX" &&
          legalGender.currentValue.checked === true &&
          legalGender.currentValue.selectedExportValue === femaleExport,
      );
    } catch (error) {
      assert(
        "multi-widget female export preserves selected export value",
        false,
        String(error),
      );
    }
  }

  try {
    await fillPdfForm(
      fixtureBuffer,
      setCheckboxFieldValue(createInitialFormState(loaded.fields), "Gender", true, "Female"),
    );
    assert("invalid humanized export rejected on export", false);
  } catch (error) {
    assert(
      "invalid humanized export rejected on export",
      error instanceof FillPdfError &&
        error.code === "INVALID_FIELD_VALUE" &&
        mapValidationErrorToMessage(error).includes("isn't supported"),
    );
  }

  if (multiToggleError) {
    assert("prior multi-widget failure resolved", false, String(multiToggleError));
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
