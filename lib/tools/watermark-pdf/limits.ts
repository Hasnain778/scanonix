/** Watermark PDF safety limits (Phase 124B). */

/** Maximum source PDF size (bytes) — aligned with free-tier upload limit. */
export const MAX_WATERMARK_PDF_BYTES = 10 * 1024 * 1024;

/** Maximum PDF pages processed in-browser — aligned with Sign/Organize/Crop. */
export const MAX_WATERMARK_PDF_PAGES = 200;

/** Maximum watermark text length. */
export const MAX_WATERMARK_TEXT_LENGTH = 200;

export const MIN_WATERMARK_FONT_SIZE = 12;
export const MAX_WATERMARK_FONT_SIZE = 120;
export const DEFAULT_WATERMARK_FONT_SIZE = 48;

/** Margin presets in PDF points (visible-local space). */
export const WATERMARK_MARGIN_SMALL = 24;
export const WATERMARK_MARGIN_MEDIUM = 36;
export const WATERMARK_MARGIN_LARGE = 48;
export const DEFAULT_WATERMARK_MARGIN = WATERMARK_MARGIN_MEDIUM;

export const MIN_WATERMARK_MARGIN = WATERMARK_MARGIN_SMALL;
export const MAX_WATERMARK_MARGIN = WATERMARK_MARGIN_LARGE;

export const DEFAULT_WATERMARK_COLOR = "#666666";
export const DEFAULT_WATERMARK_OPACITY = 0.3;

export const MIN_WATERMARK_OPACITY = 0.1;
export const MAX_WATERMARK_OPACITY = 1.0;

export const MIN_WATERMARK_ROTATION = -360;
export const MAX_WATERMARK_ROTATION = 360;
export const DEFAULT_CENTER_DIAGONAL_ROTATION = -45;

/** Image watermark limits — aligned with Sign PDF signature assets. */
export const MAX_WATERMARK_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_WATERMARK_IMAGE_LONG_EDGE = 2048;

export const MIN_RELATIVE_WIDTH_RATIO = 0.05;
export const MAX_RELATIVE_WIDTH_RATIO = 0.8;
export const DEFAULT_RELATIVE_WIDTH_RATIO = 0.2;
