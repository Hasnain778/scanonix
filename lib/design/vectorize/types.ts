/** Internal vectorization profiles shared by future Design & Vector tools. */
export type VectorizePreset = "general" | "logo" | "advanced";

export type VectorizeInputMime = "image/png" | "image/jpeg" | "image/webp";

export interface VectorizeImageOptions {
  /** Profile controlling default tracer settings. Defaults to `"general"`. */
  preset?: VectorizePreset;
  /** Palette size override (imagetracer `numberofcolors`). */
  colorCount?: number;
  /**
   * Detail / noise control mapped to path omission.
   * Higher = simpler paths (more omission). Typical range 0–32.
   */
  detail?: number;
  /** Line/curve error thresholds — higher = smoother / less faithful. */
  smoothing?: number;
  /**
   * When true, transparent / near-white background regions are omitted from
   * the SVG where practical (logo-oriented).
   */
  ignoreBackground?: boolean;
}

export interface VectorizeTraceMetadata {
  preset: VectorizePreset;
  colorCount: number;
  pathOmit: number;
  lineThreshold: number;
  curveThreshold: number;
  ignoreBackground: boolean;
  pathCount: number;
  tracer: "imagetracerjs";
}

export interface VectorizeImageResult {
  svg: string;
  width: number;
  height: number;
  byteSize: number;
  mimeType: VectorizeInputMime;
  meta: VectorizeTraceMetadata;
}

export type VectorizeErrorCode =
  | "EMPTY_INPUT"
  | "TOO_LARGE"
  | "UNSUPPORTED_TYPE"
  | "INVALID_IMAGE"
  | "DIMENSIONS_TOO_LARGE"
  | "PIXEL_LIMIT_EXCEEDED"
  | "TRACE_FAILED"
  | "INVALID_SVG_OUTPUT";

export class VectorizeError extends Error {
  readonly code: VectorizeErrorCode;

  constructor(code: VectorizeErrorCode, message: string) {
    super(message);
    this.name = "VectorizeError";
    this.code = code;
  }
}

/** Prototype / API safety limits — tighten further before heavy public traffic. */
export const VECTORIZE_MAX_BYTES = 5 * 1024 * 1024;
export const VECTORIZE_MAX_DIMENSION = 2048;
export const VECTORIZE_MIN_DIMENSION = 1;
/**
 * Sharp `limitInputPixels` cap — bound decode memory before full raster expand.
 * Matches max logical canvas (2048×2048).
 */
export const VECTORIZE_MAX_INPUT_PIXELS =
  VECTORIZE_MAX_DIMENSION * VECTORIZE_MAX_DIMENSION;
