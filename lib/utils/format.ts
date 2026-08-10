export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createFileId(): string {
  return crypto.randomUUID();
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-() ]+/g, "_").trim() || "download";
}

export function timestampSuffix(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function buildTimestampedFilename(
  prefix: string,
  extension: string,
): string {
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  return `${prefix}-${timestampSuffix()}${ext}`;
}
