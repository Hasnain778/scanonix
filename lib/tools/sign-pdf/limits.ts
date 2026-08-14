/** Client-side Sign PDF safety limits (Phase 119B). */

/** Maximum PDF pages processed in-browser. */
export const MAX_SIGN_PDF_PAGES = 200;

/** Maximum signature overlays per document. */
export const MAX_SIGNATURE_PLACEMENTS = 20;

/** Maximum uploaded/drawn signature image file size (bytes). */
export const MAX_SIGNATURE_IMAGE_BYTES = 2 * 1024 * 1024;

/** Maximum longest edge for signature raster assets (pixels). */
export const MAX_SIGNATURE_IMAGE_LONG_EDGE = 2048;
