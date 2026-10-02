/** Client-side Crop PDF safety limits (Phase 121B). */

/** Maximum PDF pages processed in-browser — aligned with Sign/Organize PDF. */
export const MAX_CROP_PDF_PAGES = 200;

/**
 * Minimum normalized width/height for a valid crop (2% of visible area).
 * Prevents zero-area or degenerate CropBox export.
 */
export const MIN_NORMALIZED_CROP_SIZE = 0.02;
