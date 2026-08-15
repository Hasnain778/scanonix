/** Fill PDF Forms core types (Phase 123B). */

import type { NormalizedCropRect, PdfBox } from "../crop-pdf/types";
import type { FormTextFormatState, TextFieldAppearanceHint } from "./text-appearance";

export type DocumentFormType =
  | "ACROFORM"
  | "XFA"
  | "HYBRID_XFA_ACROFORM"
  | "NO_FORM";

export type FormFieldKind =
  | "TEXT"
  | "CHECKBOX"
  | "RADIO"
  | "DROPDOWN"
  | "OPTION_LIST"
  | "BUTTON"
  | "SIGNATURE"
  | "UNKNOWN";

export interface FormWidgetDescriptor {
  /** Stable index within the parent field's widget list. */
  widgetIndex: number;
  /** 0-based page index in the loaded document. */
  pageIndex: number;
  /** Widget rectangle in PDF user space (bottom-left origin). */
  pdfRect: PdfBox;
  /** Normalized visual rectangle relative to the page visible box. */
  normalizedRect: NormalizedCropRect;
  /** Per-widget export/on value when the PDF assigns one. */
  widgetExportValue?: string;
  /** Display-only label derived from the widget export/on value. */
  widgetDisplayLabel?: string;
  /** For RADIO fields — the option value represented by this widget. */
  widgetOptionValue?: string;
}

export interface FormFieldDescriptor {
  /** Stable fully-qualified AcroForm field name. */
  name: string;
  kind: FormFieldKind;
  readOnly: boolean;
  required: boolean;
  /** Present for DROPDOWN, OPTION_LIST, and RADIO fields. */
  options?: string[];
  /** Present for TEXT fields when MaxLen is set. */
  maxLength?: number;
  /** True for multiline text fields. */
  multiline?: boolean;
  /** Parsed source /DA hints for TEXT fields. */
  textAppearance?: TextFieldAppearanceHint;
  /** Present for CHECKBOX fields — the widget on/export value when checked. */
  exportOnValue?: string;
  /** Current value captured at load time. */
  currentValue: FormFieldValue;
  widgets: FormWidgetDescriptor[];
}

export type FormFieldValue =
  | { kind: "TEXT"; value: string }
  | { kind: "CHECKBOX"; checked: boolean; selectedExportValue?: string | null }
  | { kind: "RADIO"; selected: string | null }
  | { kind: "DROPDOWN"; selected: string | null }
  | { kind: "OPTION_LIST"; selected: string[] }
  | { kind: "BUTTON" }
  | { kind: "SIGNATURE" }
  | { kind: "UNKNOWN" };

/** Edit state keyed by stable field name. */
export type FormEditState = Record<string, FormFieldValue>;

export interface FillPdfWarnings {
  hasExistingDigitalSignatures: boolean;
  hasJavaScriptActions: boolean;
}

export interface FillPdfDocumentState {
  documentFormType: DocumentFormType;
  pageCount: number;
  fields: FormFieldDescriptor[];
  initialValues: FormEditState;
  warnings: FillPdfWarnings;
}

export type FillPdfErrorCode =
  | "WRONG_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_PAGES"
  | "TOO_MANY_FIELDS"
  | "CORRUPT_PDF"
  | "PASSWORD_PDF"
  | "XFA_UNSUPPORTED"
  | "HYBRID_XFA_UNSUPPORTED"
  | "NO_FORM_FIELDS"
  | "UNSUPPORTED_FIELD_TYPE"
  | "INVALID_FIELD_VALUE"
  | "READ_ONLY_FIELD"
  | "TEXT_TOO_LONG"
  | "UNSUPPORTED_CHARACTERS"
  | "MALFORMED_WIDGET"
  | "APPEARANCE_UPDATE_FAILED"
  | "EXPORT_FAILED";

export class FillPdfError extends Error {
  readonly code: FillPdfErrorCode;

  constructor(code: FillPdfErrorCode, message: string) {
    super(message);
    this.name = "FillPdfError";
    this.code = code;
  }
}

export function getFillPdfErrorMessage(error: unknown): string {
  if (error instanceof FillPdfError) {
    return error.message;
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong while processing this PDF form.";
}

export const DIGITAL_SIGNATURE_WARNING =
  "This PDF contains existing digital signatures. Editing and re-saving may invalidate them.";

export const FILL_PDF_PRIVACY_COPY =
  "Your PDF is processed entirely in your browser. Files are never uploaded to our servers.";

export interface FillPdfExportOptions {
  /** Reserved for future use — V1 never flattens by default. */
  flatten?: boolean;
  /** Per-field text appearance keyed by stable field name. */
  textFormatState?: FormTextFormatState;
}

export interface FillPdfExportResult {
  bytes: Uint8Array;
  filename: string;
  warnings: FillPdfWarnings;
  skippedReadOnlyFields: string[];
  skippedUnsupportedFields: string[];
}
