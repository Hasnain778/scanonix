/** Add Page Numbers PDF safety limits (Phase 122B). */

/** Maximum source PDF size (bytes) — aligned with free-tier upload limit. */
export const MAX_ADD_PAGE_NUMBERS_BYTES = 10 * 1024 * 1024;

/** Maximum PDF pages processed in-browser — aligned with Sign/Organize/Crop. */
export const MAX_ADD_PAGE_NUMBERS_PAGES = 200;

export const MIN_PAGE_NUMBER_FONT_SIZE = 8;
export const MAX_PAGE_NUMBER_FONT_SIZE = 36;
export const DEFAULT_PAGE_NUMBER_FONT_SIZE = 10;

export const MIN_STARTING_NUMBER = 1;
export const MAX_STARTING_NUMBER = 99_999;

/** Margin presets in PDF points (visible-local space). */
export const PAGE_NUMBER_MARGIN_SMALL = 24;
export const PAGE_NUMBER_MARGIN_MEDIUM = 36;
export const PAGE_NUMBER_MARGIN_LARGE = 48;
export const DEFAULT_PAGE_NUMBER_MARGIN = PAGE_NUMBER_MARGIN_MEDIUM;

export const MIN_PAGE_NUMBER_MARGIN = PAGE_NUMBER_MARGIN_SMALL;
export const MAX_PAGE_NUMBER_MARGIN = PAGE_NUMBER_MARGIN_LARGE;

export const DEFAULT_PAGE_NUMBER_COLOR = "#000000";
