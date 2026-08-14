/** Sign PDF core types — placement uses normalized visual coordinates (Phase 119B). */

export type SignatureSourceType = "draw" | "type" | "upload";

export type PageRotation = 0 | 90 | 180 | 270;

/** How a signature asset is stored for export (PNG bytes preferred). */
export interface SignatureAsset {
  id: string;
  sourceType: SignatureSourceType;
  /** PNG or JPEG bytes — PNG preferred for alpha. */
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg";
}

/**
 * Normalized placement relative to the **visual** page (what PDF.js renders).
 *
 * Values are fractions of visual width/height (0–1), top-left origin.
 * This representation is stable when the browser preview is resized because
 * UI converts DOM pixels → normalized immediately; export never reads raw DOM coords.
 */
export interface NormalizedPlacement {
  id: string;
  pageIndex: number;
  normX: number;
  normY: number;
  normWidth: number;
  normHeight: number;
  signatureAssetId: string;
}

/** Preview-space rectangle (top-left origin, CSS/display pixels). */
export interface PreviewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** PDF user-space rectangle for pdf-lib drawImage (bottom-left origin, points). */
export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Unrotated media box + rotation metadata for one page. */
export interface PageGeometry {
  mediaWidth: number;
  mediaHeight: number;
  rotation: PageRotation;
  visualWidth: number;
  visualHeight: number;
}

export type SignPdfErrorCode =
  | "PASSWORD_PDF"
  | "CORRUPT_PDF"
  | "NO_PAGES"
  | "NO_PLACEMENTS"
  | "INVALID_PLACEMENT"
  | "MISSING_ASSET"
  | "UNSUPPORTED_SIGNATURE"
  | "EXPORT_FAILED";

export class SignPdfError extends Error {
  readonly code: SignPdfErrorCode;

  constructor(code: SignPdfErrorCode, message: string) {
    super(message);
    this.name = "SignPdfError";
    this.code = code;
  }
}

export function getSignPdfErrorMessage(error: unknown): string {
  if (error instanceof SignPdfError) {
    return error.message;
  }

  return error instanceof Error
    ? error.message
    : "Could not sign this PDF. The file may be corrupt or unsupported.";
}
