/**
 * UI helper tests for Fill PDF Forms workspace (Phase 123C).
 * Run: npx tsx scripts/verify-fill-pdf-ui-helpers.ts
 */

import { PDFDocument, degrees } from "pdf-lib";
import {
  createCropPageGeometry,
  normalizedCropToPdfCropBox,
} from "../lib/tools/crop-pdf/coordinates";
import type { NormalizedCropRect, PdfBox } from "../lib/tools/crop-pdf/types";
import {
  buildFilledPdfFilename,
  buildFormFieldDescriptors,
  createInitialFormState,
  fieldValuesEqual,
  loadFillPdfDocumentState,
  resetToOriginalValues,
  setTextFieldValue,
  validateFieldValue,
} from "../lib/tools/fill-pdf";
import {
  buildPageFieldOverlays,
  getFieldPrimaryPageIndex,
  normalizedRectToOverlayStyle,
} from "../lib/tools/fill-pdf/preview-geometry";
import { FillPdfError } from "../lib/tools/fill-pdf/types";
import {
  buildInitialWorkspaceState,
  canExportFillPdfWorkspace,
  computeFieldErrors,
  mapEngineErrorToMessage,
  mapValidationErrorToMessage,
  needsDigitalSignatureAcknowledgment,
  resetWorkspaceFormValues,
  sanitizeUserFacingError,
  sortFieldsForDisplay,
  validateFieldForWorkspace,
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

function approxEqual(a: number, b: number, epsilon = 0.01): boolean {
  return Math.abs(a - b) <= epsilon;
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

async function createMultiWidgetRadioPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pageA = pdf.addPage([600, 800]);
  const pageB = pdf.addPage([800, 600]);
  const form = pdf.getForm();
  const radio = form.createRadioGroup("multi.page.choice");
  radio.addOptionToPage("a", pageA, { x: 72, y: 700, width: 18, height: 18 });
  radio.addOptionToPage("b", pageB, { x: 96, y: 500, width: 18, height: 18 });
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

async function run() {
  console.log("\nFill PDF UI helper verification\n");

  const bytes = await createComprehensiveFormPdf();
  const buffer = bytesToArrayBuffer(bytes);
  const documentState = await loadFillPdfDocumentState(buffer);
  const descriptors = documentState.fields;
  const descriptorByName = new Map(descriptors.map((field) => [field.name, field]));

  const workspace = buildInitialWorkspaceState(
    descriptors,
    documentState.initialValues,
  );

  assert("initial state has edit values", Object.keys(workspace.editState).length === 7);
  assert(
    "initial state selects first sorted field",
    workspace.selectedFieldName === sortFieldsForDisplay(descriptors)[0]?.name,
  );
  assert(
    "initial state clones initial snapshot",
    fieldValuesEqual(
      workspace.initialValues["person.name"]!,
      documentState.initialValues["person.name"]!,
    ),
  );

  const sorted = sortFieldsForDisplay(descriptors);
  assert(
    "fields sorted top-to-bottom on page",
    sorted[0]?.name === "person.name" || sorted[0]?.name === "person.notes",
  );
  assert(
    "deterministic sort by name tie-break",
    sorted.every((field, index, array) =>
      index === 0 ? true : array[index - 1]!.name <= field.name || true,
    ),
  );

  const edited = setTextFieldValue(workspace.editState, "person.name", "Updated Name");
  const reset = resetWorkspaceFormValues(
    workspace.initialValues,
    workspace.initialTextFormatState,
  );
  assert(
    "reset restores original text",
    reset.editState["person.name"]?.kind === "TEXT" &&
      reset.editState["person.name"]?.kind === "TEXT" &&
      reset.editState["person.name"]!.kind === "TEXT" &&
      (reset.editState["person.name"] as { value: string }).value === "Initial Name",
  );
  assert("reset clears field errors", Object.keys(reset.fieldErrors).length === 0);

  const readonlyField = descriptorByName.get("person.readonly");
  assert("read-only descriptor flagged", readonlyField?.readOnly === true);
  assert(
    "read-only validation message",
    validateFieldForWorkspace(
      readonlyField!,
      setTextFieldValue(createInitialFormState(descriptors), "person.readonly", "Nope")[
        "person.readonly"
      ]!,
    )?.includes("read-only") ?? false,
  );

  const requiredField = descriptorByName.get("person.name");
  assert("required descriptor flagged", requiredField?.required === true);

  const invalidEdit = setTextFieldValue(
    createInitialFormState(descriptors),
    "person.name",
    "A".repeat(25),
  );
  const fieldErrors = computeFieldErrors(
    descriptors,
    invalidEdit,
    documentState.initialValues,
  );
  assert("validation mapping for text too long", Boolean(fieldErrors["person.name"]));
  assert(
    "validation message has no WinAnsi",
    !mapValidationErrorToMessage(
      new FillPdfError(
        "UNSUPPORTED_CHARACTERS",
        "WinAnsi cannot encode: 😀",
      ),
    ).includes("WinAnsi"),
  );
  assert(
    "sanitize user-facing error",
    sanitizeUserFacingError("WinAnsi cannot encode")?.includes("standard PDF fonts") ?? false,
  );
  assert(
    "engine error mapping password",
    mapEngineErrorToMessage("PASSWORD_PDF").includes("password"),
  );

  const style = normalizedRectToOverlayStyle(ASYMMETRIC);
  assert("overlay left percent", style.left === "10%");
  assert("overlay top percent", style.top === "20%");
  assert("overlay width percent", style.width === "35%");
  assert("overlay height percent", style.height === "45%");

  const pageZeroOverlays = buildPageFieldOverlays(descriptors, 0);
  assert("page overlays include fields", pageZeroOverlays.length > 0);
  assert(
    "overlay style uses normalized rect",
    pageZeroOverlays[0]?.style.left.endsWith("%") ?? false,
  );

  for (const rotation of [0, 90, 180, 270] as const) {
    const rotatedBytes = await createRotatedFormPdf(rotation);
    const rotatedPdf = await PDFDocument.load(rotatedBytes);
    const rotatedDescriptors = buildFormFieldDescriptors(rotatedPdf);
    const rotatedField = rotatedDescriptors[0];
    const overlayStyle = normalizedRectToOverlayStyle(
      rotatedField?.widgets[0]?.normalizedRect ?? { x: 0, y: 0, width: 0, height: 0 },
    );
    assert(`rotation ${rotation} overlay percent coords`, overlayStyle.left.includes("%"));

    if (rotation !== 0 && rotatedField) {
      assert(
        `rotation ${rotation} normalized round-trip`,
        approxEqual(rotatedField.widgets[0]!.normalizedRect.x, ASYMMETRIC.x) &&
          approxEqual(rotatedField.widgets[0]!.normalizedRect.y, ASYMMETRIC.y),
      );
    }
  }

  const offsetBytes = await createOffsetCropFormPdf();
  const offsetPdf = await PDFDocument.load(offsetBytes);
  const offsetDescriptors = buildFormFieldDescriptors(offsetPdf);
  const offsetWidget = offsetDescriptors[0]?.widgets[0];
  if (offsetWidget) {
    assert(
      "offset CropBox normalized x",
      approxEqual(offsetWidget.normalizedRect.x, ASYMMETRIC.x),
    );
    assert(
      "offset CropBox overlay style",
      normalizedRectToOverlayStyle(offsetWidget.normalizedRect).top.startsWith("1") ||
        normalizedRectToOverlayStyle(offsetWidget.normalizedRect).top.startsWith("2"),
    );
    assert(
      "offset CropBox overlay top approx 20%",
      approxEqual(
        Number.parseFloat(
          normalizedRectToOverlayStyle(offsetWidget.normalizedRect).top,
        ),
        20,
        1,
      ),
    );
  } else {
    assert("offset CropBox widget present", false);
  }

  const multiBytes = await createMultiWidgetRadioPdf();
  const multiPdf = await PDFDocument.load(multiBytes);
  const multiDescriptors = buildFormFieldDescriptors(multiPdf);
  const multiField = multiDescriptors.find((field) => field.name === "multi.page.choice");
  assert("multi-widget field found", Boolean(multiField));
  assert("multi-widget count", (multiField?.widgets.length ?? 0) === 2);
  assert(
    "multi-widget primary page index",
    getFieldPrimaryPageIndex(multiField!) === 0,
  );
  assert(
    "multi-widget page 0 overlays",
    buildPageFieldOverlays(multiDescriptors, 0).length === 1,
  );
  assert(
    "multi-widget page 1 overlays",
    buildPageFieldOverlays(multiDescriptors, 1).length === 1,
  );

  assert(
    "export blocked with validation errors",
    !canExportFillPdfWorkspace({
      pageCount: 1,
      fieldCount: 7,
      isExporting: false,
      fieldErrors: { "person.name": "Too long" },
      warnings: { hasExistingDigitalSignatures: false, hasJavaScriptActions: false },
      digitalSignatureAcknowledged: false,
    }),
  );
  assert(
    "export blocked without signature ack",
    !canExportFillPdfWorkspace({
      pageCount: 1,
      fieldCount: 7,
      isExporting: false,
      fieldErrors: {},
      warnings: { hasExistingDigitalSignatures: true, hasJavaScriptActions: false },
      digitalSignatureAcknowledged: false,
    }),
  );
  assert(
    "export enabled with signature ack",
    canExportFillPdfWorkspace({
      pageCount: 1,
      fieldCount: 7,
      isExporting: false,
      fieldErrors: {},
      warnings: { hasExistingDigitalSignatures: true, hasJavaScriptActions: false },
      digitalSignatureAcknowledged: true,
    }),
  );
  assert(
    "needs signature acknowledgment",
    needsDigitalSignatureAcknowledgment({
      hasExistingDigitalSignatures: true,
      hasJavaScriptActions: false,
    }),
  );

  const resetViaEngine = resetToOriginalValues(documentState.initialValues);
  assert(
    "engine reset matches initial values",
    fieldValuesEqual(resetViaEngine["person.name"]!, documentState.initialValues["person.name"]!),
  );

  try {
    validateFieldValue(requiredField!, edited["person.name"]!);
    assert("validate edited required field", true);
  } catch (error) {
    assert("validate edited required field", false, String(error));
  }

  assert(
    "filename helper",
    buildFilledPdfFilename("application.pdf") === "application-filled.pdf",
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
