export {
  MAX_FILL_PDF_BYTES,
  MAX_FILL_PDF_FIELDS,
  MAX_FILL_PDF_PAGES,
  MAX_FILL_PDF_TEXT_LENGTH_FALLBACK,
} from "./limits";

export {
  loadFillPdfDocumentState,
  type LoadFillPdfDocumentOptions,
} from "./load-document";

export { fillPdfForm } from "./fill-pdf";

export { buildFilledPdfFilename } from "./filename";

export {
  buildFormFieldDescriptors,
} from "./field-descriptors";

export {
  cloneFieldValue,
  createInitialFormState,
  fieldValuesEqual,
  getEditedFieldNames,
  resetToOriginalValues,
  setCheckboxFieldValue,
  setDropdownFieldValue,
  setOptionListFieldValue,
  setRadioFieldValue,
  setTextFieldValue,
} from "./field-values";

export {
  containsUnsupportedWinAnsiCharacters,
  findUnsupportedWinAnsiCharacters,
  validateEditState,
  validateFieldValue,
  validateTextCharacters,
} from "./validation";

export {
  bytesContainAcroFormReference,
  bytesContainXfaReference,
  collectFillPdfWarnings,
  detectDocumentFormType,
  detectExistingDigitalSignatures,
  hasJSActions,
  isPdfBytes,
} from "./detect-form";

export {
  isValidNormalizedWidgetRect,
  readPdfBox,
  widgetRectToNormalizedVisual,
  type PageBoxContext,
} from "./widget-geometry";

export {
  DIGITAL_SIGNATURE_WARNING,
  FILL_PDF_PRIVACY_COPY,
  FillPdfError,
  getFillPdfErrorMessage,
  type DocumentFormType,
  type FillPdfDocumentState,
  type FillPdfErrorCode,
  type FillPdfExportOptions,
  type FillPdfExportResult,
  type FillPdfWarnings,
  type FormEditState,
  type FormFieldDescriptor,
  type FormFieldKind,
  type FormFieldValue,
  type FormWidgetDescriptor,
} from "./types";

export {
  formatChoiceOptionLabel,
  getCheckboxChoiceLabel,
  getWidgetChoiceLabel,
  hasDistinctWidgetChoices,
  humanizeFieldDisplayName,
  isGenericExportOnValue,
  splitHierarchicalFieldName,
} from "./presentation";

export {
  buildInitialWorkspaceState,
  buildFieldPresentationEntries,
  buildFieldsNavigatorEntries,
  canExportFillPdfWorkspace,
  clampFillPdfZoomFactor,
  cloneWorkspaceEditState,
  computeFieldErrors,
  computeFillPdfEditorContainerWidth,
  computeFillPdfZoomedDisplaySize,
  countEditableFields,
  FILL_PDF_UI_PRIVACY_COPY,
  FILL_PDF_ZOOM_FIT_WIDTH,
  FILL_PDF_ZOOM_MAX,
  FILL_PDF_ZOOM_MIN,
  FILL_PDF_ZOOM_STEP,
  formatFillPdfZoomPercent,
  getFieldDisplayLabel,
  getFieldGroupReadOnlyState,
  getFieldGroupRequiredState,
  getFieldPageLabel,
  getFieldsNavigatorSummary,
  getNextFieldName,
  getNextMissingRequiredFieldName,
  getPreviousFieldName,
  getSelectedFieldPageIndex,
  getSelectedTextFormatState,
  isEditableFieldKind,
  isEditablePresentationField,
  isFieldComplete,
  isFieldValueEmpty,
  isSelectedTextField,
  computeWorkspaceFieldProgress,
  mapEngineErrorToMessage,
  mapValidationErrorToMessage,
  needsDigitalSignatureAcknowledgment,
  resetWorkspaceFormValues,
  sanitizeUserFacingError,
  sortFieldsForDisplay,
  stepFillPdfZoomFactor,
  summarizeDocument,
  updateSelectedTextFormatState,
  validateFieldForWorkspace,
  type FieldPresentationEntry,
  type FieldsNavigatorEntry,
  type FieldsNavigatorSummary,
  type FillPdfWorkspaceState,
  type FillPdfZoomMode,
  type WorkspaceFieldProgress,
} from "./workspace-ui";

export {
  buildInitialTextFormatState,
  calculateAutoFontSize,
  clampManualFontSize,
  cloneTextFormatState,
  createDefaultTextFormatState,
  cssFontFamilyForFormat,
  embedHelveticaVariants,
  getVisiblePageHeightFromWidget,
  parseDefaultAppearance,
  pdfPointsToCssPixels,
  resolveEffectiveFontSize,
  selectHelveticaFont,
  TEXT_FONT_SIZE_MAX,
  TEXT_FONT_SIZE_MIN,
  TEXT_UNDERLINE_SUPPORTED,
  textFormatStatesEqual,
  type FormTextFormatState,
  type TextFieldAppearanceHint,
  type TextFontSize,
  type TextFormatState,
} from "./text-appearance";

export {
  buildPageFieldOverlays,
  getFieldPrimaryPageIndex,
  getWidgetsForPage,
  normalizedRectToOverlayStyle,
  overlayStyleToPixelRect,
  overlayStyleToPixelRectWithZoom,
  type FieldOverlayStyle,
  type OverlayPixelRect,
  type PageFieldOverlayEntry,
} from "./preview-geometry";
