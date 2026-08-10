export function sanitizePdfText(value: string | null | undefined, maxLength = 4000): string {
  if (!value) return "";

  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
