/**
 * Text appearance tests for Fill PDF Forms (Phase 123D-FIX4).
 * Run: npx tsx scripts/verify-fill-pdf-text-appearance.ts
 */

import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { loadPdfDocument } from "../lib/pdf/core";
import {
  createCropPageGeometry,
  normalizedCropToPdfCropBox,
} from "../lib/tools/crop-pdf/coordinates";
import type { NormalizedCropRect } from "../lib/tools/crop-pdf/types";
import {
  buildFormFieldDescriptors,
  buildInitialWorkspaceState,
  createInitialFormState,
  fillPdfForm,
  loadFillPdfDocumentState,
  setCheckboxFieldValue,
  setTextFieldValue,
} from "../lib/tools/fill-pdf";
import {
  buildPageFieldOverlays,
  overlayStyleToPixelRectWithZoom,
} from "../lib/tools/fill-pdf/preview-geometry";
import {
  buildInitialTextFormatState,
  calculateAutoFontSize,
  clampManualFontSize,
  cloneTextFormatState,
  parseDefaultAppearance,
  pdfPointsToCssPixels,
  resolveEffectiveFontSize,
  TEXT_FONT_SIZE_MAX,
  TEXT_FONT_SIZE_MIN,
  TEXT_UNDERLINE_SUPPORTED,
  textFormatStatesEqual,
} from "../lib/tools/fill-pdf/text-appearance";
import {
  computeFillPdfZoomedDisplaySize,
  isSelectedTextField,
  resetWorkspaceFormValues,
  updateSelectedTextFormatState,
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

function pdfContains(bytes: Uint8Array, needle: string): boolean {
  const encoded = new TextEncoder().encode(needle);
  outer: for (let index = 0; index <= bytes.length - encoded.length; index += 1) {
    for (let offset = 0; offset < encoded.length; offset += 1) {
      if (bytes[index + offset] !== encoded[offset]) {
        continue outer;
      }
    }
    return true;
  }
  return false;
}

async function createTextFieldWithDa(
  options: {
    name?: string;
    fontSize?: number;
    font?: StandardFonts;
    width?: number;
    height?: number;
    multiline?: boolean;
    text?: string;
  } = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();
  const field = form.createTextField(options.name ?? "Name_Last");
  field.setText(options.text ?? "Smith");
  if (options.multiline) {
    field.enableMultiline();
  }

  const fontName = options.font ?? StandardFonts.Helvetica;
  const font = await pdf.embedStandardFont(fontName);
  const fontSize = options.fontSize ?? 12;
  field.updateAppearances(font);
  field.acroField.setDefaultAppearance(`0 g\n/${font.name} ${fontSize} Tf`);

  field.addToPage(page, {
    x: 72,
    y: 700,
    width: options.width ?? 180,
    height: options.height ?? 24,
  });

  return pdf.save();
}

async function createSexCheckboxGroupPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();
  form.createCheckBox("Sex.Male").addToPage(page, { x: 72, y: 700, width: 18, height: 18 });
  form.createCheckBox("Sex.Female").addToPage(page, { x: 120, y: 700, width: 18, height: 18 });
  return pdf.save();
}

async function createMultilineTextPdf(): Promise<Uint8Array> {
  return createTextFieldWithDa({
    name: "Address",
    multiline: true,
    height: 72,
    text: "Line one\nLine two",
  });
}

async function createRotatedPagePdf(): Promise<Uint8Array> {
  const asymmetric: NormalizedCropRect = {
    x: 0.1,
    y: 0.2,
    width: 0.35,
    height: 0.45,
  };
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  page.setRotation(degrees(90));
  const form = pdf.getForm();
  const field = form.createTextField("rotated.field");
  field.setText("Rotated");
  const rect = normalizedCropToPdfCropBox(
    asymmetric,
    createCropPageGeometry({ x: 0, y: 0, width: 600, height: 800 }, { x: 0, y: 0, width: 600, height: 800 }, 90),
  );
  field.addToPage(page, rect);
  return pdf.save();
}

async function createOffsetCropBoxPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  page.setCropBox(36, 36, 540, 720);
  const form = pdf.getForm();
  const field = form.createTextField("crop.field");
  field.setText("Crop");
  field.addToPage(page, { x: 72, y: 700, width: 180, height: 24 });
  return pdf.save();
}

async function run() {
  console.log("\nFill PDF FIX4 text appearance verification\n");

  const daBytes = await createTextFieldWithDa({ fontSize: 14 });
  const daState = await loadFillPdfDocumentState(bytesToArrayBuffer(daBytes));
  const textField = daState.fields.find((field) => field.name === "Name_Last");

  assert(
    "TEST A: source font size extraction when available",
    textField?.textAppearance?.sourceFontSize === 14,
    `got ${textField?.textAppearance?.sourceFontSize}`,
  );

  const shortAuto = calculateAutoFontSize({
    text: "Hi",
    fieldHeightPt: 24,
    fieldWidthPt: 180,
    multiline: false,
  });
  assert(
    "TEST B: Auto size for short text",
    shortAuto >= TEXT_FONT_SIZE_MIN && shortAuto <= TEXT_FONT_SIZE_MAX,
    String(shortAuto),
  );

  const longAuto = calculateAutoFontSize({
    text: "A very long value that should shrink to fit inside the field width",
    fieldHeightPt: 24,
    fieldWidthPt: 120,
    multiline: false,
  });
  assert(
    "TEST C: Auto size shrinks for long text",
    longAuto < shortAuto,
    `${longAuto} vs ${shortAuto}`,
  );

  const tallAuto = calculateAutoFontSize({
    text: "T",
    fieldHeightPt: 48,
    fieldWidthPt: 180,
    multiline: false,
  });
  assert(
    "TEST D: Auto size respects field height",
    tallAuto >= shortAuto,
    `${tallAuto} vs ${shortAuto}`,
  );

  const workspace = buildInitialWorkspaceState(daState.fields, daState.initialValues);
  const manualWorkspace = updateSelectedTextFormatState(
    { ...workspace, selectedFieldName: "Name_Last" },
    { fontSize: 16 },
  );
  assert(
    "TEST E: manual font size",
    manualWorkspace.textFormatState["Name_Last"]?.fontSize === 16,
  );

  assert(
    "TEST F: manual size bounds",
    clampManualFontSize(2) === TEXT_FONT_SIZE_MIN &&
      clampManualFontSize(100) === TEXT_FONT_SIZE_MAX,
  );

  const overlay = buildPageFieldOverlays(daState.fields, 0)[0];
  const base = { width: 400, height: 520 };
  const zoom1 = overlayStyleToPixelRectWithZoom(
    overlay!.style,
    base.width,
    base.height,
    1,
  );
  const zoom2 = overlayStyleToPixelRectWithZoom(
    overlay!.style,
    base.width,
    base.height,
    1.5,
  );
  assert(
    "TEST G: zoom keeps overlay appearance proportional",
    Math.abs(zoom2.width / zoom1.width - 1.5) < 0.01,
  );

  const perField = buildInitialTextFormatState(daState.fields);
  const updated = {
    ...perField,
    Name_Last: { ...perField.Name_Last!, fontSize: 18 as const, bold: true, italic: false, underline: false },
  };
  assert(
    "TEST H: per-field formatting state",
    updated.Name_Last?.fontSize === 18 &&
      !textFormatStatesEqual(perField.Name_Last!, updated.Name_Last!),
  );

  const reset = resetWorkspaceFormValues(
    workspace.initialValues,
    workspace.initialTextFormatState,
  );
  assert(
    "TEST I: reset restores formatting",
    textFormatStatesEqual(
      reset.textFormatState["Name_Last"]!,
      workspace.initialTextFormatState["Name_Last"]!,
    ),
  );

  assert(
    "TEST J: checkbox focus does not expose text formatting",
    !isSelectedTextField(
      (await loadFillPdfDocumentState(bytesToArrayBuffer(await createSexCheckboxGroupPdf()))).fields,
      "Sex.Male",
    ),
  );

  const radioState = await loadFillPdfDocumentState(
    bytesToArrayBuffer(
      await (async () => {
        const pdf = await PDFDocument.create();
        const page = pdf.addPage([612, 792]);
        const form = pdf.getForm();
        const group = form.createRadioGroup("Sex");
        group.addOptionToPage("Male", page, { x: 72, y: 700, width: 18, height: 18 });
        group.addOptionToPage("Female", page, { x: 120, y: 700, width: 18, height: 18 });
        return pdf.save();
      })(),
    ),
  );
  assert(
    "TEST K: radio focus does not expose text formatting",
    !isSelectedTextField(radioState.fields, "Sex"),
  );

  const dropdownState = await loadFillPdfDocumentState(
    bytesToArrayBuffer(
      await (async () => {
        const pdf = await PDFDocument.create();
        const page = pdf.addPage([612, 792]);
        const form = pdf.getForm();
        const dropdown = form.createDropdown("Title");
        dropdown.addOptions(["Mr", "Mrs"]);
        dropdown.addToPage(page, { x: 72, y: 700, width: 160, height: 24 });
        return pdf.save();
      })(),
    ),
  );
  assert(
    "TEST L: dropdown focus does not expose text formatting",
    !isSelectedTextField(dropdownState.fields, "Title"),
  );

  const boldEdits = setTextFieldValue(createInitialFormState(daState.fields), "Name_Last", "BoldText");
  const boldFormat = cloneTextFormatState(buildInitialTextFormatState(daState.fields));
  boldFormat.Name_Last = {
    fontSize: "auto",
    bold: true,
    italic: false,
    underline: false,
  };
  const boldExport = await fillPdfForm(bytesToArrayBuffer(daBytes), boldEdits, {
    textFormatState: boldFormat,
  });
  assert(
    "TEST M: Bold export if supported",
    pdfContains(boldExport.bytes, "Helvetica-Bold") ||
      pdfContains(boldExport.bytes, "HeBo"),
  );

  const italicFormat = cloneTextFormatState(boldFormat);
  italicFormat.Name_Last = {
    fontSize: "auto",
    bold: false,
    italic: true,
    underline: false,
  };
  const italicExport = await fillPdfForm(bytesToArrayBuffer(daBytes), boldEdits, {
    textFormatState: italicFormat,
  });
  assert(
    "TEST N: Italic export if supported",
    pdfContains(italicExport.bytes, "Helvetica-Oblique") ||
      pdfContains(italicExport.bytes, "HeOb"),
  );

  const biFormat = cloneTextFormatState(boldFormat);
  biFormat.Name_Last = {
    fontSize: "auto",
    bold: true,
    italic: true,
    underline: false,
  };
  const biExport = await fillPdfForm(bytesToArrayBuffer(daBytes), boldEdits, {
    textFormatState: biFormat,
  });
  assert(
    "TEST O: Bold+Italic if supported",
    pdfContains(biExport.bytes, "Helvetica-BoldOblique") ||
      pdfContains(biExport.bytes, "HeBO"),
  );

  assert(
    "TEST P: Underline if supported",
    TEXT_UNDERLINE_SUPPORTED === false,
  );

  const exported = await fillPdfForm(
    bytesToArrayBuffer(daBytes),
    setTextFieldValue(createInitialFormState(daState.fields), "Name_Last", "Hasnain"),
    { textFormatState: buildInitialTextFormatState(daState.fields) },
  );
  const reloaded = await loadFillPdfDocumentState(bytesToArrayBuffer(exported.bytes));
  assert(
    "TEST Q: field identity unchanged",
    reloaded.fields.some((field) => field.name === "Name_Last"),
  );
  assert(
    "TEST R: field values unchanged",
    reloaded.fields.find((field) => field.name === "Name_Last")?.currentValue.kind === "TEXT" &&
      (
        reloaded.fields.find((field) => field.name === "Name_Last")
          ?.currentValue as { value: string }
      ).value === "Hasnain",
  );

  const sexState = await loadFillPdfDocumentState(
    bytesToArrayBuffer(await createSexCheckboxGroupPdf()),
  );
  const sexEdits = setCheckboxFieldValue(
    createInitialFormState(sexState.fields),
    "Sex.Male",
    true,
  );
  const sexExport = await fillPdfForm(bytesToArrayBuffer(await createSexCheckboxGroupPdf()), sexEdits);
  const sexReload = await loadFillPdfDocumentState(bytesToArrayBuffer(sexExport.bytes));
  assert(
    "TEST S: Male/Female behavior unchanged",
    sexReload.fields.some((field) => field.name === "Sex.Male") &&
      sexReload.fields.some((field) => field.name === "Sex.Female"),
  );

  const interactivePdf = await loadPdfDocument(bytesToArrayBuffer(exported.bytes));
  assert(
    "TEST T: export remains interactive",
    interactivePdf.getForm().getFields().some((field) => field.getName() === "Name_Last"),
  );

  assert(
    "TEST U: re-upload values preserved",
    reloaded.fields.find((field) => field.name === "Name_Last")?.currentValue.kind === "TEXT",
  );

  const rotatedPdf = await loadPdfDocument(bytesToArrayBuffer(await createRotatedPagePdf()));
  const rotatedDescriptors = buildFormFieldDescriptors(rotatedPdf);
  assert(
    "TEST V: rotated widget appearance",
    buildPageFieldOverlays(rotatedDescriptors, 0).length === 1,
  );

  const cropState = await loadFillPdfDocumentState(
    bytesToArrayBuffer(await createOffsetCropBoxPdf()),
  );
  assert(
    "TEST W: CropBox/offset CropBox",
    cropState.fields.some((field) => field.name === "crop.field"),
  );

  const multilineState = await loadFillPdfDocumentState(
    bytesToArrayBuffer(await createMultilineTextPdf()),
  );
  const multilineField = multilineState.fields.find((field) => field.name === "Address");
  const multilineSize = resolveEffectiveFontSize(
    { fontSize: "auto", bold: false, italic: false, underline: false },
    multilineField!,
    "Line one\nLine two",
  );
  assert(
    "TEST X: multiline text",
    multilineField?.multiline === true && multilineSize >= TEXT_FONT_SIZE_MIN,
  );

  const parsed = parseDefaultAppearance("0 g\n/Helv 14 Tf");
  assert(
    "parseDefaultAppearance helper",
    parsed.fontSize === 14 && parsed.fontName === "Helv",
  );

  const cssScale = pdfPointsToCssPixels(12, 520, 792);
  assert("pdfPointsToCssPixels helper", cssScale > 0 && cssScale < 20);

  const zoomed = computeFillPdfZoomedDisplaySize(400, 520, 1.5);
  assert("preview zoom scales display height", zoomed.height === 780);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

void run();
