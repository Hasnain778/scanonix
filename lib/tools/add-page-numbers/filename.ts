export function buildNumberedPdfFilename(originalName: string): string {
  const trimmed = originalName.trim();
  const withoutExtension = trimmed.replace(/\.pdf$/i, "") || "document";
  return `${withoutExtension}-numbered.pdf`;
}
