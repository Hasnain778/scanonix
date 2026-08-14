export type {
  NormalizedPlacement,
  PageGeometry,
  PageRotation,
  PdfRect,
  PreviewRect,
  SignatureAsset,
  SignatureSourceType,
} from "./types";

export { SignPdfError, getSignPdfErrorMessage } from "./types";

export {
  MAX_SIGN_PDF_PAGES,
  MAX_SIGNATURE_IMAGE_BYTES,
  MAX_SIGNATURE_IMAGE_LONG_EDGE,
  MAX_SIGNATURE_PLACEMENTS,
} from "./limits";

export {
  clampNormalizedPlacement,
  convertVisualPointToPdf,
  createPageGeometry,
  getVisualDimensions,
  normalizePageRotation,
  normalizedPlacementToPdfRect,
  normalizedToPreviewRect,
  previewRectToNormalized,
  previewRectToPdfRect,
} from "./coordinates";

export {
  SIGNATURE_TYPED_FONT_STYLES,
  createDrawnSignatureAssetFromCanvas,
  createDrawnSignatureAssetFromStrokes,
  createSignatureAssetFromBytes,
  createTypedSignatureAsset,
  normalizeUploadedSignatureFile,
  validateSignatureImageFile,
} from "./signature-assets";

export type {
  DrawStrokePoint,
  SignatureTypedFontStyleId,
} from "./signature-assets";

export { buildSignedPdfFilename } from "./filename";
export { signPdfDocument } from "./sign-pdf";

export {
  canExportSignPdf,
  createDefaultPlacement,
  getPlacementsForPage,
  movePreviewRect,
  previewRectToNormalizedPlacement,
} from "./placement-ui";

export {
  getSignatureAssetAspectRatio,
  loadSignPdfDocumentMetadata,
} from "./pdf-metadata";
