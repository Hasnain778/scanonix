import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import {
  PDFButton,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFField,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField,
  StandardFonts,
} from "pdf-lib";
import { buildFormFieldDescriptors } from "./field-descriptors";
import { applyCheckboxFieldValue } from "./checkbox-field-value";
import { fieldValuesEqual } from "./field-values";
import {
  collectFillPdfWarnings,
  detectDocumentFormType,
  isPdfBytes,
} from "./detect-form";
import { buildFilledPdfFilename } from "./filename";
import {
  MAX_FILL_PDF_BYTES,
  MAX_FILL_PDF_FIELDS,
  MAX_FILL_PDF_PAGES,
} from "./limits";
import {
  applyTextFieldDefaultAppearance,
  buildInitialTextFormatState,
  embedHelveticaVariants,
  resolveEffectiveFontSize,
  selectHelveticaFont,
  shouldApplyTextAppearance,
  type FormTextFormatState,
} from "./text-appearance";
import type {
  FillPdfExportOptions,
  FillPdfExportResult,
  FormEditState,
  FormFieldDescriptor,
  FormFieldValue,
} from "./types";
import { FillPdfError } from "./types";
import { validateEditState } from "./validation";

function isEditableFieldKind(kind: FormFieldDescriptor["kind"]): boolean {
  return (
    kind === "TEXT" ||
    kind === "CHECKBOX" ||
    kind === "RADIO" ||
    kind === "DROPDOWN" ||
    kind === "OPTION_LIST"
  );
}

function isInvalidAcroFieldValueError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Attempted to set invalid field value")
  );
}

function wrapFieldApplyError(error: unknown, fieldName: string): never {
  if (error instanceof FillPdfError) {
    throw error;
  }

  if (isInvalidAcroFieldValueError(error)) {
    throw new FillPdfError(
      "INVALID_FIELD_VALUE",
      `Field "${fieldName}": That value isn't supported by this PDF field.`,
    );
  }

  throw error instanceof Error ? error : new Error(String(error));
}

function applyFieldValue(
  field: PDFField,
  value: FormFieldValue,
  descriptor?: FormFieldDescriptor,
): void {
  switch (value.kind) {
    case "TEXT":
      (field as PDFTextField).setText(value.value);
      return;
    case "CHECKBOX":
      applyCheckboxFieldValue(
        field as PDFCheckBox,
        value,
        descriptor?.kind === "CHECKBOX" ? descriptor : undefined,
      );
      return;
    case "RADIO":
      if (value.selected) {
        (field as PDFRadioGroup).select(value.selected);
      } else {
        (field as PDFRadioGroup).clear();
      }
      return;
    case "DROPDOWN":
      if (value.selected) {
        (field as PDFDropdown).select(value.selected);
      } else {
        (field as PDFDropdown).clear();
      }
      return;
    case "OPTION_LIST":
      (field as PDFOptionList).select(value.selected);
      return;
    default:
      return;
  }
}

function shouldSkipField(
  descriptor: FormFieldDescriptor,
  initialValues: FormEditState,
  edits: FormEditState,
): "readonly" | "unsupported" | "apply" | "unchanged" {
  if (!isEditableFieldKind(descriptor.kind)) {
    return "unsupported";
  }

  if (descriptor.readOnly) {
    return "readonly";
  }

  const editedValue = edits[descriptor.name];
  if (!editedValue) {
    return "unchanged";
  }

  const initialValue = initialValues[descriptor.name];
  if (initialValue && fieldValuesEqual(initialValue, editedValue)) {
    return "unchanged";
  }

  return "apply";
}

async function updateFormFieldAppearances(
  pdf: PDFDocument,
  descriptors: FormFieldDescriptor[],
  initialValues: FormEditState,
  edits: FormEditState,
  textFormatState: FormTextFormatState,
  initialTextFormatState: FormTextFormatState,
): Promise<void> {
  const form = pdf.getForm();
  const defaultFont = await pdf.embedStandardFont(StandardFonts.Helvetica);
  const helveticaFonts = await embedHelveticaVariants(pdf);

  form.updateFieldAppearances(defaultFont);

  for (const descriptor of descriptors) {
    if (descriptor.kind !== "TEXT") {
      continue;
    }

    if (
      !shouldApplyTextAppearance(
        descriptor,
        initialValues,
        edits,
        initialTextFormatState,
        textFormatState,
      )
    ) {
      continue;
    }

    const field = form.getTextField(descriptor.name);
    const editedValue = edits[descriptor.name];
    const text =
      editedValue?.kind === "TEXT"
        ? editedValue.value
        : descriptor.currentValue.kind === "TEXT"
          ? descriptor.currentValue.value
          : "";

    const format =
      textFormatState[descriptor.name] ??
      initialTextFormatState[descriptor.name];
    if (!format) {
      continue;
    }

    const font = selectHelveticaFont(helveticaFonts, format);
    const fontSize =
      format.fontSize === "auto"
        ? 0
        : resolveEffectiveFontSize(format, descriptor, text);

    applyTextFieldDefaultAppearance(field, font, fontSize);
    field.defaultUpdateAppearances(font);
  }
}

export async function fillPdfForm(
  originalBytes: ArrayBuffer,
  edits: FormEditState,
  options: FillPdfExportOptions = {},
): Promise<FillPdfExportResult> {
  if (options.flatten) {
    // V1 intentionally ignores flatten — interactive fields remain editable.
  }

  if (!isPdfBytes(originalBytes)) {
    throw new FillPdfError(
      "WRONG_FILE_TYPE",
      "Only PDF files are supported for form filling.",
    );
  }

  if (originalBytes.byteLength > MAX_FILL_PDF_BYTES) {
    throw new FillPdfError(
      "FILE_TOO_LARGE",
      `This PDF exceeds the ${Math.round(MAX_FILL_PDF_BYTES / (1024 * 1024))}MB size limit.`,
    );
  }

  const documentFormType = await detectDocumentFormType(originalBytes);

  if (documentFormType === "XFA") {
    throw new FillPdfError(
      "XFA_UNSUPPORTED",
      "This PDF uses XFA forms, which are not supported.",
    );
  }

  if (documentFormType === "HYBRID_XFA_ACROFORM") {
    throw new FillPdfError(
      "HYBRID_XFA_UNSUPPORTED",
      "This PDF mixes XFA and AcroForm data, which is not supported.",
    );
  }

  let pdf: PDFDocument;

  try {
    pdf = await loadPdfDocument(originalBytes);
  } catch (error) {
    if (error instanceof PdfLoadError) {
      throw new FillPdfError(
        error.code === "PASSWORD" ? "PASSWORD_PDF" : "CORRUPT_PDF",
        error.message,
      );
    }

    throw new FillPdfError(
      "CORRUPT_PDF",
      error instanceof Error ? error.message : "Could not read this PDF.",
    );
  }

  const pageCount = pdf.getPageCount();
  if (pageCount > MAX_FILL_PDF_PAGES) {
    throw new FillPdfError(
      "TOO_MANY_PAGES",
      `This PDF has ${pageCount} pages. The maximum supported is ${MAX_FILL_PDF_PAGES}.`,
    );
  }

  const descriptors = buildFormFieldDescriptors(pdf);
  if (descriptors.length === 0) {
    throw new FillPdfError(
      "NO_FORM_FIELDS",
      "This PDF does not contain any fillable form fields.",
    );
  }

  if (descriptors.length > MAX_FILL_PDF_FIELDS) {
    throw new FillPdfError(
      "TOO_MANY_FIELDS",
      `This PDF has ${descriptors.length} form fields. The maximum supported is ${MAX_FILL_PDF_FIELDS}.`,
    );
  }

  const initialValues = Object.fromEntries(
    descriptors.map((descriptor) => [descriptor.name, descriptor.currentValue]),
  ) as FormEditState;

  validateEditState(descriptors, edits, initialValues);

  const form = pdf.getForm();
  const skippedReadOnlyFields: string[] = [];
  const skippedUnsupportedFields: string[] = [];

  for (const descriptor of descriptors) {
    const action = shouldSkipField(descriptor, initialValues, edits);

    if (action === "readonly") {
      skippedReadOnlyFields.push(descriptor.name);
      continue;
    }

    if (action === "unsupported") {
      skippedUnsupportedFields.push(descriptor.name);
      continue;
    }

    if (action === "unchanged") {
      continue;
    }

    const field = form.getField(descriptor.name);
    const editedValue = edits[descriptor.name];

    if (
      field instanceof PDFSignature ||
      field instanceof PDFButton
    ) {
      skippedUnsupportedFields.push(descriptor.name);
      continue;
    }

    try {
      applyFieldValue(field, editedValue, descriptor);
    } catch (error) {
      wrapFieldApplyError(error, descriptor.name);
    }
  }

  const initialTextFormatState = buildInitialTextFormatState(descriptors);
  const textFormatState = options.textFormatState ?? initialTextFormatState;

  try {
    await updateFormFieldAppearances(
      pdf,
      descriptors,
      initialValues,
      edits,
      textFormatState,
      initialTextFormatState,
    );
  } catch (error) {
    if (isInvalidAcroFieldValueError(error)) {
      throw new FillPdfError(
        "INVALID_FIELD_VALUE",
        "That value isn't supported by this PDF field.",
      );
    }

    throw new FillPdfError(
      "APPEARANCE_UPDATE_FAILED",
      error instanceof Error
        ? error.message
        : "Could not update form field appearances.",
    );
  }

  let bytes: Uint8Array;

  try {
    bytes = await pdf.save({ updateFieldAppearances: false });
  } catch (error) {
    if (isInvalidAcroFieldValueError(error)) {
      throw new FillPdfError(
        "INVALID_FIELD_VALUE",
        "That value isn't supported by this PDF field.",
      );
    }

    throw new FillPdfError(
      "EXPORT_FAILED",
      error instanceof Error ? error.message : "Could not export the filled PDF.",
    );
  }

  return {
    bytes,
    filename: buildFilledPdfFilename("document.pdf"),
    warnings: collectFillPdfWarnings(originalBytes),
    skippedReadOnlyFields,
    skippedUnsupportedFields,
  };
}
