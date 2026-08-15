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
} from "pdf-lib";
import type {
  FormFieldDescriptor,
  FormFieldKind,
  FormFieldValue,
  FormWidgetDescriptor,
} from "./types";
import { FillPdfError } from "./types";
import {
  isValidNormalizedWidgetRect,
  readPdfBox,
  widgetRectToNormalizedVisual,
  type PageBoxContext,
} from "./widget-geometry";
import { formatChoiceOptionLabel } from "./presentation";
import {
  inferBoldItalicFromFontName,
  parseDefaultAppearance,
} from "./text-appearance";

function mapFieldKind(field: PDFField): FormFieldKind {
  if (field instanceof PDFTextField) return "TEXT";
  if (field instanceof PDFCheckBox) return "CHECKBOX";
  if (field instanceof PDFRadioGroup) return "RADIO";
  if (field instanceof PDFDropdown) return "DROPDOWN";
  if (field instanceof PDFOptionList) return "OPTION_LIST";
  if (field instanceof PDFButton) return "BUTTON";
  if (field instanceof PDFSignature) return "SIGNATURE";
  return "UNKNOWN";
}

function readCheckboxCurrentValue(field: PDFCheckBox): FormFieldValue {
  const widgets = field.acroField.getWidgets();
  const activeValue = field.acroField.getValue()?.decodeText();

  if (widgets.length > 1 && activeValue && activeValue !== "Off") {
    const widgetExportValues = widgets
      .map((widget) => widget.getOnValue()?.decodeText())
      .filter((value): value is string => Boolean(value));
    const uniqueValues = new Set(widgetExportValues);

    if (uniqueValues.size > 1) {
      const selectedExportValue = widgetExportValues.includes(activeValue)
        ? activeValue
        : null;

      return {
        kind: "CHECKBOX",
        checked: selectedExportValue !== null,
        selectedExportValue,
      };
    }
  }

  return { kind: "CHECKBOX", checked: field.isChecked() };
}

function readCurrentValue(field: PDFField, kind: FormFieldKind): FormFieldValue {
  switch (kind) {
    case "TEXT":
      return { kind: "TEXT", value: (field as PDFTextField).getText() ?? "" };
    case "CHECKBOX":
      return readCheckboxCurrentValue(field as PDFCheckBox);
    case "RADIO": {
      const selected = (field as PDFRadioGroup).getSelected();
      return { kind: "RADIO", selected: selected ?? null };
    }
    case "DROPDOWN": {
      const selected = (field as PDFDropdown).getSelected();
      return { kind: "DROPDOWN", selected: selected.length > 0 ? selected[0] : null };
    }
    case "OPTION_LIST":
      return {
        kind: "OPTION_LIST",
        selected: [...(field as PDFOptionList).getSelected()],
      };
    case "BUTTON":
      return { kind: "BUTTON" };
    case "SIGNATURE":
      return { kind: "SIGNATURE" };
    default:
      return { kind: "UNKNOWN" };
  }
}

function readFieldOptions(field: PDFField, kind: FormFieldKind): string[] | undefined {
  if (kind === "RADIO") {
    return [...(field as PDFRadioGroup).getOptions()];
  }

  if (kind === "DROPDOWN") {
    return [...(field as PDFDropdown).getOptions()];
  }

  if (kind === "OPTION_LIST") {
    return [...(field as PDFOptionList).getOptions()];
  }

  return undefined;
}

function findWidgetPageIndex(
  pdf: PDFDocument,
  widget: ReturnType<PDFField["acroField"]["getWidgets"]>[number],
): number {
  const pageRef = widget.P();
  const pages = pdf.getPages();

  if (pageRef) {
    const directMatch = pages.findIndex((page) => page.ref === pageRef);
    if (directMatch >= 0) {
      return directMatch;
    }
  }

  const widgetRef = pdf.context.getObjectRef(widget.dict);
  if (widgetRef) {
    const page = pdf.findPageForAnnotationRef(widgetRef);
    if (page) {
      const index = pages.findIndex((candidate) => candidate.ref === page.ref);
      if (index >= 0) {
        return index;
      }
    }
  }

  throw new FillPdfError(
    "MALFORMED_WIDGET",
    `Could not locate the page for form field widget "${widgetRef ?? "unknown"}".`,
  );
}

function readPageContext(pdf: PDFDocument, pageIndex: number): PageBoxContext {
  const page = pdf.getPage(pageIndex);
  const { x, y, width, height } = page.getMediaBox();
  const cropBox = page.getCropBox();

  return {
    mediaBox: readPdfBox({ x, y, width, height }),
    cropBox: readPdfBox(cropBox),
    rotationDegrees: page.getRotation().angle,
  };
}

function readWidgetOptionValue(
  field: PDFField,
  kind: FormFieldKind,
  widgetIndex: number,
  widgetExportValue?: string,
): string | undefined {
  if (kind === "RADIO") {
    const radioField = field as PDFRadioGroup;
    const options = radioField.getOptions();
    if (options[widgetIndex]) {
      return options[widgetIndex];
    }
  }

  return widgetExportValue;
}

function readWidgetExportValue(
  field: PDFField,
  kind: FormFieldKind,
  widget: ReturnType<PDFField["acroField"]["getWidgets"]>[number],
  widgetIndex: number,
): string | undefined {
  const onValue = widget.getOnValue()?.decodeText();
  if (onValue) {
    return onValue;
  }

  if (kind === "RADIO" || kind === "CHECKBOX") {
    const exportValues = (
      field as PDFRadioGroup | PDFCheckBox
    ).acroField.getExportValues?.();
    const exportValue = exportValues?.[widgetIndex]?.decodeText();
    if (exportValue) {
      return exportValue;
    }
  }

  if (kind === "RADIO") {
    return (field as PDFRadioGroup).getOptions()[widgetIndex];
  }

  return undefined;
}

function readWidgetDisplayLabel(exportValue?: string): string | undefined {
  if (!exportValue) {
    return undefined;
  }

  return formatChoiceOptionLabel(exportValue);
}

function buildWidgetDescriptors(
  pdf: PDFDocument,
  field: PDFField,
  kind: FormFieldKind,
): FormWidgetDescriptor[] {
  const widgets = field.acroField.getWidgets();

  return widgets.map((widget, widgetIndex) => {
    const pageIndex = findWidgetPageIndex(pdf, widget);
    const pageContext = readPageContext(pdf, pageIndex);
    const pdfRect = readPdfBox(widget.getRectangle());
    const normalizedRect = widgetRectToNormalizedVisual(pdfRect, pageContext);
    const widgetExportValue = readWidgetExportValue(field, kind, widget, widgetIndex);
    const widgetOptionValue = readWidgetOptionValue(
      field,
      kind,
      widgetIndex,
      widgetExportValue,
    );

    if (!isValidNormalizedWidgetRect(normalizedRect)) {
      throw new FillPdfError(
        "MALFORMED_WIDGET",
        `Field "${field.getName()}" has an invalid widget rectangle.`,
      );
    }

    const descriptor: FormWidgetDescriptor = {
      widgetIndex,
      pageIndex,
      pdfRect,
      normalizedRect,
    };

    if (widgetExportValue) {
      descriptor.widgetExportValue = widgetExportValue;
      descriptor.widgetDisplayLabel = readWidgetDisplayLabel(widgetExportValue);
    }

    if (widgetOptionValue) {
      descriptor.widgetOptionValue = widgetOptionValue;
      if (!descriptor.widgetDisplayLabel) {
        descriptor.widgetDisplayLabel = readWidgetDisplayLabel(widgetOptionValue);
      }
    }

    return descriptor;
  });
}

export function buildFormFieldDescriptors(pdf: PDFDocument): FormFieldDescriptor[] {
  const form = pdf.getForm();
  const fields = form.getFields();

  return fields.map((field) => {
    const kind = mapFieldKind(field);
    const options = readFieldOptions(field, kind);
    const descriptor: FormFieldDescriptor = {
      name: field.getName(),
      kind,
      readOnly: field.isReadOnly(),
      required: field.isRequired(),
      currentValue: readCurrentValue(field, kind),
      widgets: buildWidgetDescriptors(pdf, field, kind),
    };

    if (options) {
      descriptor.options = options;
    }

    if (kind === "TEXT") {
      const textField = field as PDFTextField;
      descriptor.multiline = textField.isMultiline();
      const maxLength = textField.getMaxLength();
      if (maxLength !== undefined) {
        descriptor.maxLength = maxLength;
      }

      const widgets = textField.acroField.getWidgets();
      const widgetDa = widgets[0]?.getDefaultAppearance();
      const fieldDa = textField.acroField.getDefaultAppearance();
      const parsed = parseDefaultAppearance(widgetDa ?? fieldDa);
      const style = inferBoldItalicFromFontName(parsed.fontName);
      descriptor.textAppearance = {
        ...(parsed.fontSize !== undefined
          ? { sourceFontSize: parsed.fontSize }
          : {}),
        ...(style.bold ? { sourceBold: true } : {}),
        ...(style.italic ? { sourceItalic: true } : {}),
      };
    }

    if (kind === "CHECKBOX") {
      const onValue = (field as PDFCheckBox).acroField.getOnValue();
      if (onValue) {
        descriptor.exportOnValue = onValue.decodeText();
      }
    }

    return descriptor;
  });
}
