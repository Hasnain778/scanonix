export function buildFilledPdfFilename(originalFilename: string): string {
  const trimmed = originalFilename.trim() || "document.pdf";
  const lower = trimmed.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const base = trimmed.slice(0, -4);
    return `${base || "document"}-filled.pdf`;
  }

  return `${trimmed}-filled.pdf`;
}
