import { PDFCheckBox, PDFName } from "pdf-lib";
import type { FormFieldDescriptor, FormFieldValue } from "./types";
import { FillPdfError } from "./types";
import { hasDistinctWidgetChoices } from "./presentation";

export function getCheckboxWidgetOnValueNames(field: PDFCheckBox): PDFName[] {
  const onValues: PDFName[] = [];

  for (const widget of field.acroField.getWidgets()) {
    const onValue = widget.getOnValue();
    if (onValue) {
      onValues.push(onValue);
    }
  }

  return onValues;
}

export function getCheckboxWidgetExportValues(field: PDFCheckBox): string[] {
  return getCheckboxWidgetOnValueNames(field).map((onValue) => onValue.decodeText());
}

export function resolveCheckboxOnValue(
  field: PDFCheckBox,
  exportValue: string,
): PDFName | null {
  for (const onValue of getCheckboxWidgetOnValueNames(field)) {
    if (onValue.decodeText() === exportValue) {
      return onValue;
    }
  }

  return null;
}

/** Set checkbox state using radio-style widget updates (pdf-lib rejects non-first on values). */
export function setMultiWidgetCheckboxOnValue(
  field: PDFCheckBox,
  targetOnValue: PDFName,
): void {
  const allowedOnValues = getCheckboxWidgetOnValueNames(field);
  const isOff = targetOnValue === PDFName.of("Off");
  const isAllowed = isOff || allowedOnValues.some((onValue) => onValue === targetOnValue);

  if (!isAllowed) {
    throw new FillPdfError(
      "INVALID_FIELD_VALUE",
      "That value isn't supported by this PDF field.",
    );
  }

  field.acroField.dict.set(PDFName.of("V"), targetOnValue);

  for (const widget of field.acroField.getWidgets()) {
    const state =
      !isOff && widget.getOnValue() === targetOnValue
        ? targetOnValue
        : PDFName.of("Off");
    widget.setAppearanceState(state);
  }

  field.defaultUpdateAppearances();
}

export function validateCheckboxExportValue(
  descriptor: FormFieldDescriptor,
  value: Extract<FormFieldValue, { kind: "CHECKBOX" }>,
): void {
  if (!value.checked) {
    return;
  }

  if (!hasDistinctWidgetChoices(descriptor)) {
    return;
  }

  const legalExportValues = descriptor.widgets
    .map((widget) => widget.widgetExportValue)
    .filter((exportValue): exportValue is string => Boolean(exportValue));

  const selected = value.selectedExportValue ?? null;
  if (!selected) {
    throw new FillPdfError(
      "INVALID_FIELD_VALUE",
      `Field "${descriptor.name}" requires a supported checkbox choice.`,
    );
  }

  if (!legalExportValues.includes(selected)) {
    throw new FillPdfError(
      "INVALID_FIELD_VALUE",
      `Field "${descriptor.name}": That value isn't supported by this PDF field.`,
    );
  }
}

export function applyCheckboxFieldValue(
  field: PDFCheckBox,
  value: Extract<FormFieldValue, { kind: "CHECKBOX" }>,
  descriptor?: FormFieldDescriptor,
): void {
  const usesDistinctWidgets =
    descriptor !== undefined && hasDistinctWidgetChoices(descriptor);

  if (usesDistinctWidgets) {
    if (!value.checked) {
      setMultiWidgetCheckboxOnValue(field, PDFName.of("Off"));
      return;
    }

    const exportValue = value.selectedExportValue;
    if (!exportValue) {
      throw new FillPdfError(
        "INVALID_FIELD_VALUE",
        descriptor
          ? `Field "${descriptor.name}": That value isn't supported by this PDF field.`
          : "That value isn't supported by this PDF field.",
      );
    }

    const onValue = resolveCheckboxOnValue(field, exportValue);
    if (!onValue) {
      throw new FillPdfError(
        "INVALID_FIELD_VALUE",
        descriptor
          ? `Field "${descriptor.name}": That value isn't supported by this PDF field.`
          : "That value isn't supported by this PDF field.",
      );
    }

    setMultiWidgetCheckboxOnValue(field, onValue);
    return;
  }

  if (value.checked) {
    field.check();
  } else {
    field.uncheck();
  }
}
