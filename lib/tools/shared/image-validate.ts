export const FREE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export function extensionFromFileName(name: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function detectImageMimeType(fileName: string, declaredType: string): string | null {
  const ext = extensionFromFileName(fileName);
  const fromExt = EXT_TO_MIME[ext];
  const normalized = declaredType.toLowerCase().split(";")[0]?.trim() ?? "";

  if (fromExt && normalized && fromExt !== normalized) {
    if (normalized === "image/jpg" && fromExt === "image/jpeg") {
      return "image/jpeg";
    }
    return fromExt;
  }

  if (fromExt) return fromExt;
  if (MIME_TO_EXT[normalized]) return normalized;
  return null;
}

export function isSupportedImageMime(mime: string): boolean {
  return mime in MIME_TO_EXT || mime === "image/jpeg";
}

export function outputMimeForFormat(format: string): string {
  switch (format.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}
