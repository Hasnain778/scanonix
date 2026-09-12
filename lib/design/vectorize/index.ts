export {
  vectorizeImage,
  validateSvgIsRealVector,
  resolveVectorizeSettings,
  VectorizeError,
  VECTORIZE_MAX_BYTES,
  VECTORIZE_MAX_DIMENSION,
  VECTORIZE_MAX_INPUT_PIXELS,
} from "./vectorize-image";

export type {
  VectorizeErrorCode,
  VectorizeImageInput,
  VectorizeImageOptions,
  VectorizeImageResult,
  VectorizeInputMime,
  VectorizePreset,
  VectorizeTraceMetadata,
} from "./vectorize-image";
