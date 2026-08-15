export {
  MAX_REDACT_CANVAS_LONG_EDGE,
  MAX_REDACT_CANVAS_PIXELS,
  MAX_REDACTED_PAGES_SOFT,
  MAX_REDACTIONS,
  MAX_REDACT_PDF_BYTES,
  MAX_REDACT_PDF_PAGES,
  MIN_NORMALIZED_REDACTION_SIZE,
  REDACT_RASTER_MIME,
  REDACT_RENDER_DPI,
  REDACT_RENDER_SCALE,
} from "./limits";

export {
  buildRedactedPdfFilename,
} from "./filename";

export {
  RedactPdfError,
  getRedactPdfErrorMessage,
  isRedactPdfError,
  throwRedactError,
} from "./errors";
export type { RedactPdfErrorCode } from "./errors";

export {
  clampNormalizedRedaction,
  computeVisibleBox,
  createRedactionPageGeometry,
  getVisualDimensions,
  normalizePageRotation,
  normalizedRedactionsToCanvasRects,
  validateNormalizedRedaction,
  type CropPageGeometry,
} from "./coordinates";

export {
  computeRedactPageRenderPlan,
  exceedsRedactCanvasLimits,
  type RedactPageRenderPlan,
} from "./render-plan";

export {
  addRedaction,
  canExportRedactPdf,
  countCleanPages,
  countRedactedPages,
  findPageBySourceIndex,
  getRedactedPageIndices,
  getRedactionsForPage,
  loadRedactionDocumentState,
  removeRedaction,
  updateRedaction,
  validateExportRedactionState,
  validateRedactionRect,
  type LoadRedactionDocumentOptions,
} from "./redaction-state";

export {
  createRasterFailureGuard,
  rasterizeRedactedPage,
  type RasterizeRedactedPageOptions,
  type RasterizedPageResult,
} from "./rasterize-page";

export {
  applyAcroFormRedactionPolicy,
  CLEAN_PAGE_ANNOTATION_POLICY,
  REDACTED_PAGE_ANNOTATION_POLICY,
} from "./acroform-policy";

export { redactPdfDocument } from "./redact-pdf";

export {
  REDACT_PERMANENT_WARNING,
  REDACT_PRIVACY_COPY,
  type NormalizedRedactionRect,
  type RedactionDocumentState,
  type RedactionPageEntry,
  type RedactionRect,
  type RedactPdfExportResult,
} from "./types";

export {
  applyRedactPreviewZoom,
  computeRedactPreviewContainerWidth,
  computeRedactPreviewDisplaySize,
  computeRedactPreviewRenderPlan,
  REDACT_PREVIEW_JPEG_QUALITY,
  type RedactPreviewDisplaySize,
} from "./preview-render";

export {
  addRedactionToState,
  applyRedactionsToDocumentState,
  canExportRedactWorkspace,
  clearAllRedactions,
  clearRedactionsForPage,
  commitRedactionHistory,
  computeFitWidthZoom,
  computeRedactionOverlayStyle,
  createRedactionHistory,
  createRedactionPageGeometryForEntry,
  detectRedactPdfWarnings,
  DIGITAL_SIGNATURE_REDACT_WARNING,
  getActivePageRedactions,
  getRedactionNavigatorItems,
  isRedactDrawModeActive,
  moveNormalizedRedaction,
  normalizedRedactionFromPointerDrag,
  pointerToNormalizedPoint,
  REDACT_DRAW_MODE,
  REDACT_FORM_ANNOTATION_WARNING,
  REDACT_PERMANENT_APPLIED_COPY,
  REDACT_RASTER_QUALITY_COPY,
  REDACT_SANITIZATION_LIMITATION_COPY,
  redoRedactionHistory,
  removeRedactionFromState,
  resizeNormalizedRedaction,
  resolveRedactExportErrorMessage,
  shouldAbortExportOnRasterFailure,
  shouldShowFormAnnotationWarning,
  stepRedactZoom,
  undoRedactionHistory,
  updateRedactionInState,
  zoomPreservesNormalizedRedactions,
  type RedactEditorMode,
  type RedactionHistoryState,
  type RedactionResizeHandle,
} from "./workspace-ui";
