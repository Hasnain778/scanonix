export function buildSignedPdfFilename(originalName: string): string {
  const baseName = originalName.replace(/\.pdf$/i, "") || "scanonix-document";
  return `${baseName}-signed.pdf`;
}
