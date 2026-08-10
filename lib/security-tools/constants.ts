export const SECURITY_TOOL_IDS = [
  "protect-pdf",
  "unlock-pdf",
  "watermark-pdf",
  "redact-pdf",
  "metadata-cleaner",
  "website-scanner",
  "website-monitoring",
] as const;

export type SecurityToolId = (typeof SECURITY_TOOL_IDS)[number];

export const SECURITY_TOOL_RATE_LIMIT = {
  limit: 15,
  windowMs: 60_000,
} as const;

export const MAX_SECURITY_PDF_BYTES = 50 * 1024 * 1024;

export const ACCEPTED_METADATA_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".tiff",
  ".tif",
] as const;
