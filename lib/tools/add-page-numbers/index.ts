export {
  MAX_ADD_PAGE_NUMBERS_BYTES,
  MAX_ADD_PAGE_NUMBERS_PAGES,
  MIN_PAGE_NUMBER_FONT_SIZE,
  MAX_PAGE_NUMBER_FONT_SIZE,
  DEFAULT_PAGE_NUMBER_FONT_SIZE,
  MIN_STARTING_NUMBER,
  MAX_STARTING_NUMBER,
  PAGE_NUMBER_MARGIN_SMALL,
  PAGE_NUMBER_MARGIN_MEDIUM,
  PAGE_NUMBER_MARGIN_LARGE,
  DEFAULT_PAGE_NUMBER_MARGIN,
  MIN_PAGE_NUMBER_MARGIN,
  MAX_PAGE_NUMBER_MARGIN,
  DEFAULT_PAGE_NUMBER_COLOR,
} from "./limits";

export {
  addPageNumbersToPdf,
  createDefaultPageNumberOptions,
} from "./add-page-numbers";

export { buildNumberedPdfFilename } from "./filename";

export { loadPageNumberDocumentState, type LoadPageNumberDocumentOptions } from "./load-document";

export {
  resolvePageSelection,
  resolvePageSelectionToZeroBased,
  buildAllPagesList,
  parsePageRangeInputToFlatPages,
  toZeroBasedIndices,
} from "./page-range";

export {
  computeDisplayNumber,
  formatPageNumber,
} from "./numbering";

export {
  computePageNumberAnchor,
  createPageNumberGeometry,
  localAnchorToNormalized,
  localAnchorToPdfDrawOptions,
  validateTextFitsInVisibleBox,
  visibleLocalPointToPdf,
  type CropPageGeometry,
  type PageNumberLocalAnchor,
  type PageNumberPdfDrawOptions,
} from "./geometry";

export {
  validateHexColor,
  validateFontSize,
  validateMargin,
  validateStartingNumber,
  validatePageNumberOptions,
  isAcceptedPageNumbersPdfFile,
  assertAcceptedPageNumbersPdfFile,
  type ParsedHexColor,
} from "./validation";

export {
  AddPageNumbersError,
  PAGE_NUMBERS_PRIVACY_COPY,
  getAddPageNumbersErrorMessage,
  type AddPageNumbersErrorCode,
  type PageNumberDocumentState,
  type PageNumberFormat,
  type PageNumberOptions,
  type PageNumberPageEntry,
  type PageNumberPosition,
  type PageNumberRotation,
  type ValidatedPageNumberOptions,
} from "./types";

export {
  CROP_PREVIEW_JPEG_QUALITY,
  clampCropPreviewDevicePixelRatio,
  computeCropPreviewContainerWidth,
  computeCropPreviewRenderPlan,
  computePreviewOverlayNormalized,
  computePreviewOverlayStyle,
  createPreviewGeometry,
  type ComputePreviewOverlayStyleArgs,
  type PreviewOverlayNormalizedResult,
  type PreviewOverlayStyle,
} from "./preview-ui";

export {
  FORMAT_OPTIONS,
  MARGIN_PRESET_OPTIONS,
  PAGE_NUMBERS_UI_PRIVACY_COPY,
  POSITION_GRID,
  canExportPageNumbersWorkspace,
  getFormatPreviewExample,
  getPositionLabel,
  resolvePreviewNumbering,
  type MarginPresetValue,
  type PreviewNumberingResult,
} from "./workspace-ui";
