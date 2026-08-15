/** Client-side Organize PDF safety limits (Phase 120B). */

/** Maximum PDF pages processed in-browser — aligned with Sign PDF. */
export const MAX_ORGANIZE_PDF_PAGES = 200;

/** Maximum source PDF size (bytes) — aligned with free-tier upload limit. */
export const MAX_ORGANIZE_PDF_BYTES = 10 * 1024 * 1024;
