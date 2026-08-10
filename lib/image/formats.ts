import type { ImageFormatId } from "@/constants/image-tools";

export const FORMAT_LABELS: Record<ImageFormatId, string> = {
  png: "PNG",
  jpg: "JPG",
  webp: "WEBP",
  heic: "HEIC",
};

export const FORMAT_MIME: Partial<Record<ImageFormatId, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
};

export function getFileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function isHeicFile(file: File): boolean {
  const extension = getFileExtension(file.name);
  if (extension === "heic" || extension === "heif") return true;
  const type = file.type.toLowerCase();
  return type === "image/heic" || type === "image/heif";
}

export function validateFormatFile(file: File, format: ImageFormatId): boolean {
  const extension = getFileExtension(file.name);
  const type = file.type.toLowerCase();

  switch (format) {
    case "png":
      return extension === "png" || type === "image/png";
    case "jpg":
      return extension === "jpg" || extension === "jpeg" || type === "image/jpeg";
    case "webp":
      return extension === "webp" || type === "image/webp";
    case "heic":
      return isHeicFile(file);
    default:
      return false;
  }
}

export function formatAcceptAttribute(format: ImageFormatId): string {
  switch (format) {
    case "png":
      return ".png,image/png";
    case "jpg":
      return ".jpg,.jpeg,image/jpeg";
    case "webp":
      return ".webp,image/webp";
    case "heic":
      return ".heic,.heif,image/heic,image/heif";
  }
}

export function outputExtension(format: ImageFormatId): string {
  return format === "jpg" ? "jpg" : format;
}

export function formatHasPotentialTransparency(format: ImageFormatId): boolean {
  return format === "png" || format === "webp";
}

export function outputSupportsTransparency(format: ImageFormatId): boolean {
  return format === "png" || format === "webp";
}
