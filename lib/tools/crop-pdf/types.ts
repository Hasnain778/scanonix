/** Crop PDF core types — normalized visual crop coordinates (Phase 121B). */

export type CropPageRotation = 0 | 90 | 180 | 270;

/**
 * Normalized crop rectangle relative to the page's **visible** area (CropBox ∩ MediaBox).
 *
 * Values are fractions of visible width/height (0–1), top-left origin.
 * Preview-size independent — UI converts DOM pixels → normalized immediately.
 */
export interface NormalizedCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** PDF user-space axis-aligned rectangle (bottom-left origin, points). */
export interface PdfBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One logical page in the crop working document.
 *
 * Array order in CropDocumentState.pages is the current UI/export order.
 * Identity is always `id`, never array index.
 */
export interface CropPageEntry {
  /** Stable UUID — never derived from array index. */
  id: string;
  /** 0-based index in the uploaded source PDF (immutable after load). */
  sourcePageIndex: number;
  /** Rotation read from the source PDF at load time. */
  intrinsicRotation: CropPageRotation;
  /** Full MediaBox captured at load (may have non-zero origin). */
  mediaBox: PdfBox;
  /** CropBox captured at load (defaults to MediaBox when absent). */
  originalCropBox: PdfBox;
  /** Intersection of MediaBox and original CropBox — what the user sees. */
  visibleBox: PdfBox;
  /** Current normalized crop relative to visibleBox (full visible = 0,0,1,1). */
  normalizedCropRect: NormalizedCropRect;
  /** True when normalizedCropRect differs from the full-visible default. */
  hasCustomCrop: boolean;
}

export interface CropDocumentState {
  pages: CropPageEntry[];
}

export type CropPdfErrorCode =
  | "FILE_TOO_LARGE"
  | "TOO_MANY_PAGES"
  | "CORRUPT_PDF"
  | "PASSWORD_PDF"
  | "INVALID_CROP"
  | "CROP_TOO_SMALL"
  | "INVALID_PAGE"
  | "EXPORT_FAILED";

export class CropPdfError extends Error {
  readonly code: CropPdfErrorCode;

  constructor(code: CropPdfErrorCode, message: string) {
    super(message);
    this.name = "CropPdfError";
    this.code = code;
  }
}

export function getCropPdfErrorMessage(error: unknown): string {
  if (error instanceof CropPdfError) {
    return error.message;
  }

  return error instanceof Error
    ? error.message
    : "Could not crop this PDF. The file may be corrupt or unsupported.";
}

/** Crop changes visible area only — not secure redaction. */
export const CROP_NOT_REDACTION_WARNING =
  "Cropping changes the visible page area. It does not securely redact or remove hidden content outside the crop.";

/** Client-side processing — no server upload. */
export const CROP_PRIVACY_COPY =
  "Your PDF is cropped locally in your browser and is not uploaded to Scanonix servers.";

/** Full-visible normalized crop — reset target. */
export const FULL_VISIBLE_CROP: NormalizedCropRect = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};
