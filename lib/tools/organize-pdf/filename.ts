export function buildOrganizedPdfFilename(originalName: string): string {
  const trimmed = originalName.trim();
  const withoutExtension = trimmed.replace(/\.pdf$/i, "") || "scanonix-document";
  return `${withoutExtension}-organized.pdf`;
}
