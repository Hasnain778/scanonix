export function buildWatermarkedPdfFilename(originalFilename: string): string {
  const trimmed = originalFilename.trim() || "document.pdf";
  const lower = trimmed.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const base = trimmed.slice(0, -4);
    return `${base || "document"}-watermarked.pdf`;
  }

  return `${trimmed}-watermarked.pdf`;
}
