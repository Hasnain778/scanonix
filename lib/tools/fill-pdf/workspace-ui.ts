/** Workspace UI helpers for Fill PDF Forms (Phase 123C). */

import {
  cloneFieldValue,
  createInitialFormState,
  fieldValuesEqual,
  resetToOriginalValues,
} from "./field-values";
import type {
  FillPdfDocumentState,
  FillPdfErrorCode,
  FillPdfWarnings,
  FormEditState,
  FormFieldDescriptor,
  FormFieldValue,
} from "./types";
import { FillPdfError } from "./types";
import { humanizeFieldDisplayName, hasDistinctWidgetChoices } from "./presentation";
import { validateFieldValue } from "./validation";
import {
  buildInitialTextFormatState,
  cloneTextFormatState,
  type FormTextFormatState,
  type TextFormatState,
} from "./text-appearance";

export type FieldPresentationEntry =
  | { kind: "single"; descriptor: FormFieldDescriptor }
  | {
      kind: "checkbox-group";
      groupKey: string;
      groupLabel: string;
      members: FormFieldDescriptor[];
    }
  | {
      kind: "widget-checkbox-group";
      groupKey: string;
      groupLabel: string;
      descriptor: FormFieldDescriptor;
    };

function buildCheckboxGroups(
  descriptors: FormFieldDescriptor[],
): Map<string, FormFieldDescriptor[]> {
  const candidates = new Map<string, FormFieldDescriptor[]>();

  for (const descriptor of descriptors) {
    if (descriptor.kind !== "CHECKBOX") {
      continue;
    }

    const dotIndex = descriptor.name.lastIndexOf(".");
    if (dotIndex <= 0 || dotIndex === descriptor.name.length - 1) {
      continue;
    }

    const parent = descriptor.name.slice(0, dotIndex);
    const members = candidates.get(parent) ?? [];
    members.push(descriptor);
    candidates.set(parent, members);
  }

  const validGroups = new Map<string, FormFieldDescriptor[]>();

  for (const [parent, members] of candidates) {
    if (members.length < 2) {
      continue;
    }

    const leaves = members.map((member) => member.name.slice(parent.length + 1));
    if (new Set(leaves).size !== members.length) {
      continue;
    }

    validGroups.set(parent, sortFieldsForDisplay(members));
  }

  return validGroups;
}

function getCheckboxGroupKey(
  descriptor: FormFieldDescriptor,
  groups: Map<string, FormFieldDescriptor[]>,
): string | null {
  if (descriptor.kind !== "CHECKBOX") {
    return null;
  }

  const dotIndex = descriptor.name.lastIndexOf(".");
  if (dotIndex <= 0) {
    return null;
  }

  const parent = descriptor.name.slice(0, dotIndex);
  return groups.has(parent) ? parent : null;
}

/** Build safe display groups from PDF structure — never guess from layout. */
export function buildFieldPresentationEntries(
  descriptors: FormFieldDescriptor[],
): FieldPresentationEntry[] {
  const sorted = sortFieldsForDisplay(descriptors);
  const checkboxGroups = buildCheckboxGroups(descriptors);
  const emittedGroups = new Set<string>();
  const entries: FieldPresentationEntry[] = [];

  for (const descriptor of sorted) {
    const groupKey = getCheckboxGroupKey(descriptor, checkboxGroups);
    if (groupKey) {
      if (!emittedGroups.has(groupKey)) {
        emittedGroups.add(groupKey);
        entries.push({
          kind: "checkbox-group",
          groupKey,
          groupLabel: humanizeFieldDisplayName(groupKey),
          members: checkboxGroups.get(groupKey)!,
        });
      }
      continue;
    }

    if (descriptor.kind === "CHECKBOX" && hasDistinctWidgetChoices(descriptor)) {
      entries.push({
        kind: "widget-checkbox-group",
        groupKey: descriptor.name,
        groupLabel: humanizeFieldDisplayName(descriptor.name),
        descriptor,
      });
      continue;
    }

    entries.push({ kind: "single", descriptor });
  }

  return entries;
}

export function getFieldGroupRequiredState(
  members: FormFieldDescriptor[],
): boolean {
  return members.some((member) => member.required);
}

export function getFieldGroupReadOnlyState(
  members: FormFieldDescriptor[],
): boolean {
  return members.every((member) => member.readOnly);
}

export const FILL_PDF_UI_PRIVACY_COPY =
  "Your PDF form is filled locally in your browser and is not uploaded to Scanonix servers.";

export interface FillPdfWorkspaceState {
  editState: FormEditState;
  initialValues: FormEditState;
  textFormatState: FormTextFormatState;
  initialTextFormatState: FormTextFormatState;
  selectedFieldName: string | null;
  fieldErrors: Record<string, string>;
  digitalSignatureAcknowledged: boolean;
}

export function sortFieldsForDisplay(
  descriptors: FormFieldDescriptor[],
): FormFieldDescriptor[] {
  return [...descriptors].sort((left, right) => {
    const pageLeft = getPrimaryPageIndex(left);
    const pageRight = getPrimaryPageIndex(right);
    if (pageLeft !== pageRight) {
      return pageLeft - pageRight;
    }

    const yLeft = getPrimaryNormalizedY(left, pageLeft);
    const yRight = getPrimaryNormalizedY(right, pageRight);
    if (yLeft !== yRight) {
      return yLeft - yRight;
    }

    const xLeft = getPrimaryNormalizedX(left, pageLeft);
    const xRight = getPrimaryNormalizedX(right, pageRight);
    if (xLeft !== xRight) {
      return xLeft - xRight;
    }

    return left.name.localeCompare(right.name);
  });
}

function getPrimaryPageIndex(descriptor: FormFieldDescriptor): number {
  return Math.min(...descriptor.widgets.map((widget) => widget.pageIndex));
}

function getPrimaryNormalizedY(
  descriptor: FormFieldDescriptor,
  pageIndex: number,
): number {
  const rects = descriptor.widgets
    .filter((widget) => widget.pageIndex === pageIndex)
    .map((widget) => widget.normalizedRect.y);
  return rects.length > 0 ? Math.min(...rects) : 0;
}

function getPrimaryNormalizedX(
  descriptor: FormFieldDescriptor,
  pageIndex: number,
): number {
  const rects = descriptor.widgets
    .filter((widget) => widget.pageIndex === pageIndex)
    .map((widget) => widget.normalizedRect.x);
  return rects.length > 0 ? Math.min(...rects) : 0;
}

export function buildInitialWorkspaceState(
  descriptors: FormFieldDescriptor[],
  initialValues: FormEditState,
): FillPdfWorkspaceState {
  const sorted = sortFieldsForDisplay(descriptors);
  const initialTextFormatState = buildInitialTextFormatState(descriptors);

  return {
    editState: createInitialFormState(descriptors),
    initialValues: resetToOriginalValues(initialValues),
    textFormatState: cloneTextFormatState(initialTextFormatState),
    initialTextFormatState,
    selectedFieldName: sorted[0]?.name ?? null,
    fieldErrors: {},
    digitalSignatureAcknowledged: false,
  };
}

export function resetWorkspaceFormValues(
  initialValues: FormEditState,
  initialTextFormatState: FormTextFormatState,
): Pick<
  FillPdfWorkspaceState,
  "editState" | "textFormatState" | "fieldErrors"
> {
  return {
    editState: resetToOriginalValues(initialValues),
    textFormatState: cloneTextFormatState(initialTextFormatState),
    fieldErrors: {},
  };
}

export function isSelectedTextField(
  descriptors: FormFieldDescriptor[],
  selectedFieldName: string | null,
): boolean {
  if (!selectedFieldName) {
    return false;
  }

  const descriptor = descriptors.find((field) => field.name === selectedFieldName);
  return descriptor?.kind === "TEXT";
}

export function getSelectedTextFormatState(
  workspace: Pick<FillPdfWorkspaceState, "textFormatState" | "selectedFieldName">,
): TextFormatState | null {
  if (!workspace.selectedFieldName) {
    return null;
  }

  return workspace.textFormatState[workspace.selectedFieldName] ?? null;
}

export function updateSelectedTextFormatState(
  workspace: FillPdfWorkspaceState,
  patch: Partial<TextFormatState>,
): FillPdfWorkspaceState {
  const fieldName = workspace.selectedFieldName;
  if (!fieldName) {
    return workspace;
  }

  const current = workspace.textFormatState[fieldName];
  if (!current) {
    return workspace;
  }

  return {
    ...workspace,
    textFormatState: {
      ...workspace.textFormatState,
      [fieldName]: {
        ...current,
        ...patch,
      },
    },
  };
}

export function mapEngineErrorToMessage(
  code: FillPdfErrorCode,
  detail?: string,
): string {
  switch (code) {
    case "WRONG_FILE_TYPE":
      return "Only PDF files are supported for form filling.";
    case "FILE_TOO_LARGE":
      return detail ?? "This PDF exceeds the maximum file size.";
    case "TOO_MANY_PAGES":
      return detail ?? "This PDF has too many pages.";
    case "TOO_MANY_FIELDS":
      return detail ?? "This PDF has too many form fields.";
    case "CORRUPT_PDF":
      return detail ?? "Could not read this PDF. The file may be damaged.";
    case "PASSWORD_PDF":
      return "This PDF is password-protected. Remove the password and try again.";
    case "XFA_UNSUPPORTED":
      return "This PDF uses XFA forms, which are not supported. Please use a standard AcroForm PDF.";
    case "HYBRID_XFA_UNSUPPORTED":
      return "This PDF mixes XFA and AcroForm data, which is not supported.";
    case "NO_FORM_FIELDS":
      return "This PDF does not contain any fillable form fields.";
    case "UNSUPPORTED_FIELD_TYPE":
      return detail ?? "One or more form fields are not supported for filling.";
    case "INVALID_FIELD_VALUE":
      return (
        sanitizeUserFacingError(detail) ??
        "That value isn't supported by this PDF field."
      );
    case "READ_ONLY_FIELD":
      return detail ?? "This field is read-only and cannot be edited.";
    case "TEXT_TOO_LONG":
      return detail ?? "Text exceeds the maximum allowed length for this field.";
    case "UNSUPPORTED_CHARACTERS":
      return (
        sanitizeUserFacingError(detail) ??
        "This field contains characters that cannot be exported with standard PDF fonts."
      );
    case "MALFORMED_WIDGET":
      return detail ?? "A form field has invalid placement data.";
    case "APPEARANCE_UPDATE_FAILED":
      return detail ?? "Could not update form field appearances.";
    case "EXPORT_FAILED":
      return detail ?? "Could not export the filled PDF.";
    default:
      return detail ?? "Something went wrong while processing this PDF form.";
  }
}

export function sanitizeUserFacingError(message?: string): string | undefined {
  if (!message) {
    return undefined;
  }

  const normalized = message
    .replace(/WinAnsi/gi, "standard PDF fonts")
    .replace(/\s+/g, " ")
    .trim();

  if (/attempted to set invalid field value/i.test(normalized)) {
    return "That value isn't supported by this PDF field.";
  }

  return normalized;
}

export function mapValidationErrorToMessage(error: unknown): string {
  if (error instanceof FillPdfError) {
    return mapEngineErrorToMessage(error.code, sanitizeUserFacingError(error.message));
  }

  if (error instanceof Error) {
    return sanitizeUserFacingError(error.message) ?? error.message;
  }

  return "That value isn't supported by this PDF field.";
}

export function validateFieldForWorkspace(
  descriptor: FormFieldDescriptor,
  value: FormFieldValue,
): string | null {
  try {
    validateFieldValue(descriptor, value);
    return null;
  } catch (error) {
    return mapValidationErrorToMessage(error);
  }
}

export function computeFieldErrors(
  descriptors: FormFieldDescriptor[],
  editState: FormEditState,
  initialValues: FormEditState,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const descriptor of descriptors) {
    const value = editState[descriptor.name];
    const initialValue = initialValues[descriptor.name];
    if (!value || !initialValue) {
      continue;
    }

    if (fieldValuesEqual(initialValue, value)) {
      continue;
    }

    const message = validateFieldForWorkspace(descriptor, value);
    if (message) {
      errors[descriptor.name] = message;
    }
  }

  return errors;
}

export function countEditableFields(descriptors: FormFieldDescriptor[]): number {
  return descriptors.filter(
    (descriptor) =>
      !descriptor.readOnly &&
      descriptor.kind !== "BUTTON" &&
      descriptor.kind !== "SIGNATURE" &&
      descriptor.kind !== "UNKNOWN",
  ).length;
}

export function needsDigitalSignatureAcknowledgment(
  warnings: FillPdfWarnings,
): boolean {
  return warnings.hasExistingDigitalSignatures;
}

export function canExportFillPdfWorkspace(options: {
  pageCount: number;
  fieldCount: number;
  isExporting: boolean;
  fieldErrors: Record<string, string>;
  warnings: FillPdfWarnings;
  digitalSignatureAcknowledged: boolean;
}): boolean {
  const {
    pageCount,
    fieldCount,
    isExporting,
    fieldErrors,
    warnings,
    digitalSignatureAcknowledged,
  } = options;

  if (pageCount <= 0 || fieldCount <= 0 || isExporting) {
    return false;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return false;
  }

  if (
    needsDigitalSignatureAcknowledgment(warnings) &&
    !digitalSignatureAcknowledged
  ) {
    return false;
  }

  return true;
}

export function getFieldDisplayLabel(descriptor: FormFieldDescriptor): string {
  return humanizeFieldDisplayName(descriptor.name);
}

export function isEditableFieldKind(
  kind: FormFieldDescriptor["kind"],
): boolean {
  return (
    kind === "TEXT" ||
    kind === "CHECKBOX" ||
    kind === "RADIO" ||
    kind === "DROPDOWN" ||
    kind === "OPTION_LIST"
  );
}

export function getSelectedFieldPageIndex(
  descriptors: FormFieldDescriptor[],
  selectedFieldName: string | null,
): number | null {
  if (!selectedFieldName) {
    return null;
  }

  const descriptor = descriptors.find((field) => field.name === selectedFieldName);
  if (!descriptor || descriptor.widgets.length === 0) {
    return null;
  }

  return getPrimaryPageIndex(descriptor);
}

export function cloneWorkspaceEditState(editState: FormEditState): FormEditState {
  const cloned: FormEditState = {};

  for (const [name, value] of Object.entries(editState)) {
    cloned[name] = cloneFieldValue(value);
  }

  return cloned;
}

export function summarizeDocument(
  document: FillPdfDocumentState,
): {
  pageCount: number;
  fieldCount: number;
} {
  return {
    pageCount: document.pageCount,
    fieldCount: document.fields.length,
  };
}

export function isEditablePresentationField(
  descriptor: FormFieldDescriptor,
): boolean {
  return isEditableFieldKind(descriptor.kind);
}

export function isFieldValueEmpty(
  descriptor: FormFieldDescriptor,
  value: FormFieldValue | undefined,
): boolean {
  if (!value || value.kind !== descriptor.kind) {
    return true;
  }

  switch (value.kind) {
    case "TEXT":
      return value.value.trim().length === 0;
    case "CHECKBOX":
      return !value.checked;
    case "RADIO":
    case "DROPDOWN":
      return value.selected === null;
    case "OPTION_LIST":
      return value.selected.length === 0;
    default:
      return true;
  }
}

export function isFieldComplete(
  descriptor: FormFieldDescriptor,
  value: FormFieldValue | undefined,
): boolean {
  if (!isEditablePresentationField(descriptor)) {
    return true;
  }

  return !isFieldValueEmpty(descriptor, value);
}

export interface WorkspaceFieldProgress {
  totalEditable: number;
  completed: number;
  requiredRemaining: number;
}

export function computeWorkspaceFieldProgress(
  descriptors: FormFieldDescriptor[],
  editState: FormEditState,
): WorkspaceFieldProgress {
  const editable = descriptors.filter(isEditablePresentationField);
  let completed = 0;
  let requiredRemaining = 0;

  for (const descriptor of editable) {
    const value = editState[descriptor.name];
    if (isFieldComplete(descriptor, value)) {
      completed += 1;
      continue;
    }

    if (descriptor.required) {
      requiredRemaining += 1;
    }
  }

  return {
    totalEditable: editable.length,
    completed,
    requiredRemaining,
  };
}

export function getOrderedEditableFieldNames(
  descriptors: FormFieldDescriptor[],
): string[] {
  return sortFieldsForDisplay(descriptors)
    .filter(isEditablePresentationField)
    .map((descriptor) => descriptor.name);
}

export function getNextFieldName(
  descriptors: FormFieldDescriptor[],
  currentFieldName: string | null,
): string | null {
  const ordered = getOrderedEditableFieldNames(descriptors);
  if (ordered.length === 0) {
    return null;
  }

  if (!currentFieldName) {
    return ordered[0] ?? null;
  }

  const currentIndex = ordered.indexOf(currentFieldName);
  if (currentIndex < 0) {
    return ordered[0] ?? null;
  }

  return ordered[currentIndex + 1] ?? null;
}

export function getPreviousFieldName(
  descriptors: FormFieldDescriptor[],
  currentFieldName: string | null,
): string | null {
  const ordered = getOrderedEditableFieldNames(descriptors);
  if (ordered.length === 0 || !currentFieldName) {
    return null;
  }

  const currentIndex = ordered.indexOf(currentFieldName);
  if (currentIndex <= 0) {
    return null;
  }

  return ordered[currentIndex - 1] ?? null;
}

export function getNextMissingRequiredFieldName(
  descriptors: FormFieldDescriptor[],
  editState: FormEditState,
  currentFieldName: string | null,
): string | null {
  const ordered = getOrderedEditableFieldNames(descriptors).filter((name) => {
    const descriptor = descriptors.find((field) => field.name === name);
    return descriptor?.required === true;
  });

  if (ordered.length === 0) {
    return null;
  }

  const startIndex = currentFieldName
    ? Math.max(
        ordered.findIndex((name) => name === currentFieldName) + 1,
        0,
      )
    : 0;

  for (let index = startIndex; index < ordered.length; index += 1) {
    const name = ordered[index]!;
    const descriptor = descriptors.find((field) => field.name === name);
    if (!descriptor) {
      continue;
    }

    if (isFieldValueEmpty(descriptor, editState[name])) {
      return name;
    }
  }

  for (let index = 0; index < startIndex; index += 1) {
    const name = ordered[index]!;
    const descriptor = descriptors.find((field) => field.name === name);
    if (!descriptor) {
      continue;
    }

    if (isFieldValueEmpty(descriptor, editState[name])) {
      return name;
    }
  }

  return null;
}

export function getFieldPageLabel(
  descriptors: FormFieldDescriptor[],
  fieldName: string,
): string | null {
  const descriptor = descriptors.find((field) => field.name === fieldName);
  if (!descriptor || descriptor.widgets.length === 0) {
    return null;
  }

  return String(getPrimaryPageIndex(descriptor) + 1);
}

export const FILL_PDF_ZOOM_MIN = 0.5;
export const FILL_PDF_ZOOM_MAX = 2;
export const FILL_PDF_ZOOM_STEP = 0.25;
export const FILL_PDF_ZOOM_FIT_WIDTH = "fit-width" as const;
export const FILL_PDF_EDITOR_MAX_CSS_WIDTH = 1200;
export const FILL_PDF_EDITOR_MIN_CSS_WIDTH = 280;
export const FILL_PDF_EDITOR_HORIZONTAL_PADDING = 32;

export type FillPdfZoomMode = typeof FILL_PDF_ZOOM_FIT_WIDTH | number;

export function clampFillPdfZoomFactor(factor: number): number {
  if (!Number.isFinite(factor)) {
    return 1;
  }

  return Math.min(FILL_PDF_ZOOM_MAX, Math.max(FILL_PDF_ZOOM_MIN, factor));
}

export function stepFillPdfZoomFactor(current: number, delta: number): number {
  const next = current + delta;
  const stepped = Math.round(next / FILL_PDF_ZOOM_STEP) * FILL_PDF_ZOOM_STEP;
  return clampFillPdfZoomFactor(stepped);
}

export function formatFillPdfZoomPercent(factor: number): string {
  return `${Math.round(clampFillPdfZoomFactor(factor) * 100)}%`;
}

export function computeFillPdfZoomedDisplaySize(
  baseWidth: number,
  baseHeight: number,
  zoomFactor: number,
): { width: number; height: number } {
  const factor = clampFillPdfZoomFactor(zoomFactor);
  return {
    width: baseWidth * factor,
    height: baseHeight * factor,
  };
}

export function computeFillPdfEditorContainerWidth(clientWidth: number): number {
  const available = Math.max(
    FILL_PDF_EDITOR_MIN_CSS_WIDTH,
    clientWidth - FILL_PDF_EDITOR_HORIZONTAL_PADDING,
  );
  return Math.min(FILL_PDF_EDITOR_MAX_CSS_WIDTH, available);
}

export interface FieldsNavigatorSummary {
  buttonLabel: string;
  completed: number;
  total: number;
  requiredRemaining: number;
}

export function getFieldsNavigatorSummary(
  descriptors: FormFieldDescriptor[],
  editState: FormEditState,
): FieldsNavigatorSummary {
  const progress = computeWorkspaceFieldProgress(descriptors, editState);
  const { completed, totalEditable, requiredRemaining } = progress;

  const buttonLabel =
    requiredRemaining > 0
      ? `Fields · ${requiredRemaining} remaining`
      : `Fields ${completed}/${totalEditable}`;

  return {
    buttonLabel,
    completed,
    total: totalEditable,
    requiredRemaining,
  };
}

export interface FieldsNavigatorEntry {
  key: string;
  fieldName: string;
  label: string;
  pageIndex: number;
  complete: boolean;
  required: boolean;
  hasError: boolean;
}

/** Compact navigation rows for the optional Fields drawer — not duplicate editors. */
export function buildFieldsNavigatorEntries(
  descriptors: FormFieldDescriptor[],
  editState: FormEditState,
  fieldErrors: Record<string, string>,
): FieldsNavigatorEntry[] {
  const presentationEntries = buildFieldPresentationEntries(descriptors);
  const entries: FieldsNavigatorEntry[] = [];

  for (const entry of presentationEntries) {
    if (entry.kind === "checkbox-group") {
      const focusName = entry.members[0]?.name ?? entry.groupKey;
      const pageIndex = getSelectedFieldPageIndex(descriptors, focusName) ?? 0;
      const groupComplete = entry.members.every((member) =>
        isFieldComplete(member, editState[member.name]),
      );
      const hasError = entry.members.some((member) =>
        Boolean(fieldErrors[member.name]),
      );

      entries.push({
        key: entry.groupKey,
        fieldName: focusName,
        label: entry.groupLabel,
        pageIndex,
        complete: groupComplete,
        required: getFieldGroupRequiredState(entry.members),
        hasError,
      });
      continue;
    }

    if (entry.kind === "widget-checkbox-group") {
      const descriptor = entry.descriptor;
      const pageIndex =
        getSelectedFieldPageIndex(descriptors, descriptor.name) ?? 0;

      entries.push({
        key: entry.groupKey,
        fieldName: descriptor.name,
        label: entry.groupLabel,
        pageIndex,
        complete: isFieldComplete(descriptor, editState[descriptor.name]),
        required: descriptor.required,
        hasError: Boolean(fieldErrors[descriptor.name]),
      });
      continue;
    }

    const descriptor = entry.descriptor;
    if (!isEditablePresentationField(descriptor)) {
      continue;
    }

    entries.push({
      key: descriptor.name,
      fieldName: descriptor.name,
      label: getFieldDisplayLabel(descriptor),
      pageIndex: getSelectedFieldPageIndex(descriptors, descriptor.name) ?? 0,
      complete: isFieldComplete(descriptor, editState[descriptor.name]),
      required: descriptor.required,
      hasError: Boolean(fieldErrors[descriptor.name]),
    });
  }

  return entries;
}
