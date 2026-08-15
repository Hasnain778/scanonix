/** Client-side Redact PDF safety limits (Phase 125B). */

/** Maximum source PDF size (bytes) — aligned with Crop/Watermark/Fill. */
export const MAX_REDACT_PDF_BYTES = 10 * 1024 * 1024;

/** Maximum PDF pages processed in-browser. */
export const MAX_REDACT_PDF_PAGES = 200;

/** Soft cap on fully rasterized pages — warn/block heavy jobs. */
export const MAX_REDACTED_PAGES_SOFT = 50;

/** Maximum redaction rectangles per document. */
export const MAX_REDACTIONS = 500;

/**
 * Minimum normalized width/height for a valid redaction (1% of visible area).
 * Prevents zero-area or degenerate export regions.
 */
export const MIN_NORMALIZED_REDACTION_SIZE = 0.01;

/** Target render resolution — fixed, not devicePixelRatio dependent. */
export const REDACT_RENDER_DPI = 200;

/** PDF.js viewport scale for ~200 DPI (72 PDF points per inch). */
export const REDACT_RENDER_SCALE = REDACT_RENDER_DPI / 72;

/** Hard cap on raster canvas longest edge (pixels). */
export const MAX_REDACT_CANVAS_LONG_EDGE = 4000;

/** Hard cap on total canvas pixels (~16 MP). */
export const MAX_REDACT_CANVAS_PIXELS = 16_000_000;

/** PNG raster format for redacted pages — lossless, no compression artifacts. */
export const REDACT_RASTER_MIME = "image/png" as const;
