/**
 * Shared PSD writer foundation (Design & Vector).
 *
 * Boundary:
 * - Callers supply normalized RGBA8 pixels (e.g. Sharp: rotate → sRGB → ensureAlpha → raw).
 * - This module does NOT decode JPEG/PNG, read EXIF, or interpret ICC/CMYK.
 * - ag-psd write path uses raw imageData only (no canvas / DOM).
 */

export const PSD_MAX_SIDE = 2048;
export const PSD_MAX_PIXELS = PSD_MAX_SIDE * PSD_MAX_SIDE;
/** Hard ceiling for encoded PSD payloads (JPG + future PNG routes). */
export const PSD_MAX_OUTPUT_BYTES = 40 * 1024 * 1024;
export const PSD_CHANNELS = 4 as const;
export const PSD_BITS_PER_CHANNEL = 8 as const;
/** Adobe RGB color mode id */
export const PSD_COLOR_MODE_RGB = 3 as const;
export const PSD_DEFAULT_LAYER_NAME = "Image";
export const PSD_LAYER_NAME_MAX_LENGTH = 64;

export type PsdErrorCode =
  | "INVALID_DIMENSIONS"
  | "DIMENSIONS_TOO_LARGE"
  | "PIXEL_LIMIT_EXCEEDED"
  | "INVALID_PIXEL_DATA"
  | "INVALID_LAYER_NAME"
  | "ENCODE_FAILED"
  | "OUTPUT_TOO_LARGE"
  | "INVALID_PSD"
  | "UNEXPECTED_STRUCTURE";

export class PsdError extends Error {
  readonly code: PsdErrorCode;

  constructor(code: PsdErrorCode, message: string) {
    super(message);
    this.name = "PsdError";
    this.code = code;
  }
}

/**
 * Normalized raster for PSD encoding.
 * Always RGBA8 interleaved (R,G,B,A). Length must be width*height*4.
 *
 * JPG route: decode → opaque RGBA (A=255), hasAlpha=false.
 * PNG route (future): may pass real alpha with hasAlpha=true.
 */
export interface PsdRasterInput {
  width: number;
  height: number;
  /** RGBA8 interleaved pixel buffer */
  data: Uint8Array | Uint8ClampedArray | Buffer;
  /** Must be 4 for this engine */
  channels: typeof PSD_CHANNELS;
  layerName: string;
  /**
   * When false, alpha is forced to 255 before encode (opaque JPG-like).
   * When true, supplied alpha is preserved.
   */
  hasAlpha: boolean;
}

export interface PsdValidationMeta {
  width: number;
  height: number;
  layerCount: number;
  colorMode: number;
  bitsPerChannel: number;
  layerName: string;
  byteLength: number;
}
