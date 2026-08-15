export {
  MAX_CROP_PDF_BYTES,
  MAX_CROP_PDF_PAGES,
  MIN_NORMALIZED_CROP_SIZE,
} from "./limits";

export {
  loadCropDocumentState,
  type LoadCropDocumentOptions,
} from "./load-document";

export {
  cropPdfDocument,
} from "./crop-pdf";

export { buildCroppedPdfFilename } from "./filename";

export {
  applyNormalizedCropToPages,
  canExportCropPdf,
  findPageIndexById,
  getApplyCropCompatibility,
  getPageById,
  hasCustomCrop,
  resetAllCrops,
  resetPageCrop,
  setCropForPage,
  validatePageCrop,
  withPages,
  type ApplyCropCompatibility,
  type ApplyCropResult,
} from "./crop-state";

export {
  clampNormalizedCrop,
  computeVisibleBox,
  convertFullVisualPointToPdf,
  createCropPageGeometry,
  getVisibleBoxVisualOrigin,
  getVisualDimensions,
  isFullVisibleCrop,
  normalizePageRotation,
  normalizedCropToPdfCropBox,
  pdfCropBoxToNormalized,
  validateNormalizedCrop,
  type CropPageGeometry,
} from "./coordinates";

export {
  CROP_NOT_REDACTION_WARNING,
  CROP_PRIVACY_COPY,
  CropPdfError,
  FULL_VISIBLE_CROP,
  getCropPdfErrorMessage,
  type CropDocumentState,
  type CropPageEntry,
  type CropPageRotation,
  type CropPdfErrorCode,
  type NormalizedCropRect,
  type PdfBox,
} from "./types";

export {
  CROP_PREVIEW_JPEG_QUALITY,
  CROP_PREVIEW_MAX_CANVAS_LONG_EDGE,
  CROP_PREVIEW_MAX_CSS_WIDTH,
  CROP_PREVIEW_MAX_DPR,
  CROP_PREVIEW_MIN_CSS_WIDTH,
  clampCropPreviewDevicePixelRatio,
  computeCropPreviewContainerWidth,
  computeCropPreviewRenderPlan,
  type CropPreviewRenderPlan,
} from "./preview-render";

export {
  canExportCropWorkspace,
  countCompatiblePages,
  countCustomCropPages,
  formatApplyCropSummary,
  getCompatiblePageIds,
  moveNormalizedCrop,
  normalizedCropFromPercentInputs,
  normalizedCropToPercentInputs,
  resizeNormalizedCrop,
  shouldClearCropStateOnReplace,
  type CropResizeHandle,
} from "./workspace-ui";
