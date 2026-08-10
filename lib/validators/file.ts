export function validateNonEmptyFile(file: File): string | null {
  if (file.size === 0) {
    return "The file is empty.";
  }
  return null;
}

export function validateFileExtension(
  file: File,
  allowedExtensions: string[],
): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const normalized = allowedExtensions.map((e) =>
    e.replace(/^\./, "").toLowerCase(),
  );
  if (!normalized.includes(ext)) {
    return `Allowed formats: ${allowedExtensions.join(", ")}`;
  }
  return null;
}

export function validateMaxFiles(
  count: number,
  max: number,
): string | null {
  if (count > max) {
    return `You can upload up to ${max} files at once.`;
  }
  return null;
}
