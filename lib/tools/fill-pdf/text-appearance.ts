/** Text field appearance helpers for Fill PDF Forms (Phase 123D-FIX4). */

import type { PDFDocument, PDFFont, PDFTextField } from "pdf-lib";
import { StandardFonts, rgb } from "pdf-lib";
import type { FormFieldDescriptor, FormFieldValue } from "./types";

export const TEXT_FONT_SIZE_MIN = 6;
export const TEXT_FONT_SIZE_MAX = 36;

export type TextFontSize = number | "auto";

export interface TextFormatState {
  fontSize: TextFontSize;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export type FormTextFormatState = Record<string, TextFormatState>;

export interface ParsedDefaultAppearance {
  fontName?: string;
  fontSize?: number;
}

export interface TextFieldAppearanceHint {
  sourceFontSize?: number;
  sourceBold?: boolean;
  sourceItalic?: boolean;
}

const TF_REGEX =
  /\/([^\0\t\n\f\r ]+)[\0\t\n\f\r ]+(\d*\.\d+|\d+)[\0\t\n\f\r ]+Tf/;

const BOLD_FONT_NAMES = new Set([
  "Helvetica-Bold",
  "HeBo",
  "Courier-Bold",
  "Times-Bold",
  "HelveticaBold",
]);

const OBLIQUE_FONT_NAMES = new Set([
  "Helvetica-Oblique",
  "Helvetica-BoldOblique",
  "HeOb",
  "HeBO",
  "Courier-Oblique",
  "Courier-BoldOblique",
  "Times-Italic",
  "Times-BoldItalic",
]);

export function parseDefaultAppearance(
  da: string | undefined,
): ParsedDefaultAppearance {
  if (!da) {
    return {};
  }

  const matches = [...da.matchAll(new RegExp(TF_REGEX.source, "g"))];
  const last = matches.at(-1);
  if (!last) {
    return {};
  }

  const fontSize = Number.parseFloat(last[2] ?? "");
  return {
    fontName: last[1],
    fontSize: Number.isFinite(fontSize) ? fontSize : undefined,
  };
}

export function inferBoldItalicFromFontName(fontName?: string): {
  bold: boolean;
  italic: boolean;
} {
  if (!fontName) {
    return { bold: false, italic: false };
  }

  const bold = BOLD_FONT_NAMES.has(fontName) || /bold/i.test(fontName);
  const italic =
    OBLIQUE_FONT_NAMES.has(fontName) ||
    /oblique|italic/i.test(fontName) ||
    fontName === "HeBO" ||
    fontName === "Helvetica-BoldOblique";

  return { bold, italic };
}

export function clampManualFontSize(size: number): number {
  if (!Number.isFinite(size)) {
    return TEXT_FONT_SIZE_MIN;
  }

  return Math.min(TEXT_FONT_SIZE_MAX, Math.max(TEXT_FONT_SIZE_MIN, Math.round(size)));
}

export function createDefaultTextFormatState(
  hint?: TextFieldAppearanceHint,
): TextFormatState {
  return {
    fontSize: "auto",
    bold: hint?.sourceBold ?? false,
    italic: hint?.sourceItalic ?? false,
    underline: false,
  };
}

export function buildInitialTextFormatState(
  descriptors: FormFieldDescriptor[],
): FormTextFormatState {
  const state: FormTextFormatState = {};

  for (const descriptor of descriptors) {
    if (descriptor.kind !== "TEXT") {
      continue;
    }

    state[descriptor.name] = createDefaultTextFormatState(descriptor.textAppearance);
  }

  return state;
}

export function cloneTextFormatState(state: FormTextFormatState): FormTextFormatState {
  const cloned: FormTextFormatState = {};

  for (const [name, format] of Object.entries(state)) {
    cloned[name] = { ...format };
  }

  return cloned;
}

export function textFormatStatesEqual(
  left: TextFormatState,
  right: TextFormatState,
): boolean {
  return (
    left.fontSize === right.fontSize &&
    left.bold === right.bold &&
    left.italic === right.italic &&
    left.underline === right.underline
  );
}

export function getPrimaryWidgetPdfHeight(descriptor: FormFieldDescriptor): number {
  const widget = descriptor.widgets[0];
  return widget?.pdfRect.height ?? 0;
}

export function getPrimaryWidgetPdfWidth(descriptor: FormFieldDescriptor): number {
  const widget = descriptor.widgets[0];
  return widget?.pdfRect.width ?? 0;
}

export function getVisiblePageHeightFromWidget(
  descriptor: FormFieldDescriptor,
): number | undefined {
  const widget = descriptor.widgets[0];
  if (!widget || widget.normalizedRect.height <= 0) {
    return undefined;
  }

  return widget.pdfRect.height / widget.normalizedRect.height;
}

/** Approximate average character width ratio for Helvetica at a given size. */
function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.5;
}

/**
 * Compute AUTO font size (PDF points) from widget dimensions and text content.
 * Mirrors pdf-lib layout heuristics with sensible min/max bounds.
 */
export function calculateAutoFontSize(options: {
  text: string;
  fieldHeightPt: number;
  fieldWidthPt: number;
  multiline: boolean;
  paddingPt?: number;
}): number {
  const {
    text,
    fieldHeightPt,
    fieldWidthPt,
    multiline,
    paddingPt = 1,
  } = options;

  const boundsHeight = Math.max(1, fieldHeightPt - paddingPt * 2);
  const boundsWidth = Math.max(1, fieldWidthPt - paddingPt * 2);
  const content = text.length > 0 ? text : "Ay";

  if (multiline) {
    const lines = content.split(/\r\n|\r|\n/);
    for (let fontSize = TEXT_FONT_SIZE_MAX; fontSize >= TEXT_FONT_SIZE_MIN; fontSize -= 1) {
      const lineHeight = fontSize * 1.2;
      const totalHeight = lineHeight * Math.max(lines.length, 1);
      if (totalHeight <= boundsHeight) {
        const widestLine = lines.reduce(
          (max, line) => Math.max(max, estimateTextWidth(line, fontSize)),
          0,
        );
        if (widestLine <= boundsWidth) {
          return fontSize;
        }
      }
    }
    return TEXT_FONT_SIZE_MIN;
  }

  for (let fontSize = TEXT_FONT_SIZE_MAX; fontSize >= TEXT_FONT_SIZE_MIN; fontSize -= 1) {
    const textHeight = fontSize * 1.0;
    const textWidth = estimateTextWidth(content, fontSize);
    if (textHeight <= boundsHeight && textWidth <= boundsWidth) {
      return fontSize;
    }
  }

  return TEXT_FONT_SIZE_MIN;
}

export function resolveEffectiveFontSize(
  format: TextFormatState,
  descriptor: FormFieldDescriptor,
  text: string,
): number {
  if (format.fontSize !== "auto") {
    return clampManualFontSize(format.fontSize);
  }

  if (descriptor.textAppearance?.sourceFontSize !== undefined) {
    return clampManualFontSize(descriptor.textAppearance.sourceFontSize);
  }

  return calculateAutoFontSize({
    text,
    fieldHeightPt: getPrimaryWidgetPdfHeight(descriptor),
    fieldWidthPt: getPrimaryWidgetPdfWidth(descriptor),
    multiline: descriptor.multiline ?? false,
  });
}

export function pdfPointsToCssPixels(
  fontSizePt: number,
  pageDisplayHeightPx: number,
  visiblePageHeightPt: number,
): number {
  if (visiblePageHeightPt <= 0 || pageDisplayHeightPx <= 0) {
    return fontSizePt;
  }

  return fontSizePt * (pageDisplayHeightPx / visiblePageHeightPt);
}

export function cssFontFamilyForFormat(format: TextFormatState): string {
  const weight = format.bold ? "700" : "400";
  const style = format.italic ? "italic" : "normal";
  return `${style} ${weight} Helvetica, Arial, sans-serif`;
}

export type HelveticaVariantKey =
  | "regular"
  | "bold"
  | "italic"
  | "boldItalic";

export interface EmbeddedHelveticaFonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
}

export async function embedHelveticaVariants(
  pdf: PDFDocument,
): Promise<EmbeddedHelveticaFonts> {
  const [regular, bold, italic, boldItalic] = await Promise.all([
    pdf.embedStandardFont(StandardFonts.Helvetica),
    pdf.embedStandardFont(StandardFonts.HelveticaBold),
    pdf.embedStandardFont(StandardFonts.HelveticaOblique),
    pdf.embedStandardFont(StandardFonts.HelveticaBoldOblique),
  ]);

  return { regular, bold, italic, boldItalic };
}

export function selectHelveticaFont(
  fonts: EmbeddedHelveticaFonts,
  format: TextFormatState,
): PDFFont {
  if (format.bold && format.italic) {
    return fonts.boldItalic;
  }
  if (format.bold) {
    return fonts.bold;
  }
  if (format.italic) {
    return fonts.italic;
  }
  return fonts.regular;
}

export function buildDefaultAppearanceString(
  font: PDFFont,
  fontSize: number,
): string {
  const size =
    fontSize === 0 ? 0 : clampManualFontSize(fontSize);
  return `0 g\n/${font.name} ${size} Tf`;
}

export function applyTextFieldDefaultAppearance(
  field: PDFTextField,
  font: PDFFont,
  fontSize: number,
): void {
  field.acroField.setDefaultAppearance(buildDefaultAppearanceString(font, fontSize));
}

export function shouldApplyTextAppearance(
  descriptor: FormFieldDescriptor,
  initialValues: Record<string, FormFieldValue>,
  edits: Record<string, FormFieldValue>,
  initialFormat: FormTextFormatState,
  currentFormat: FormTextFormatState,
): boolean {
  const editedValue = edits[descriptor.name];
  const initialValue = initialValues[descriptor.name];
  if (!editedValue || !initialValue) {
    return false;
  }

  const valueChanged =
    editedValue.kind === "TEXT" &&
    initialValue.kind === "TEXT" &&
    editedValue.value !== initialValue.value;

  const initial = initialFormat[descriptor.name];
  const current = currentFormat[descriptor.name];
  const formatChanged =
    initial && current ? !textFormatStatesEqual(initial, current) : false;

  return valueChanged || formatChanged;
}

/** Underline is not supported by pdf-lib default text field appearances. */
export const TEXT_UNDERLINE_SUPPORTED = false;
