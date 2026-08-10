import { isAcceptedPdfFile } from "../pdf-utils";
import { OcrExtractionError } from "./languages";

export const OCR_ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.pdf";

const OCR_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export function isAcceptedOcrFile(file: File): boolean {
  if (isAcceptedPdfFile(file)) {
    return true;
  }

  const type = file.type.toLowerCase();
  if (OCR_IMAGE_TYPES.includes(type as (typeof OCR_IMAGE_TYPES)[number])) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  return (
    extension === "jpg" ||
    extension === "jpeg" ||
    extension === "png" ||
    extension === "webp"
  );
}

export function isOcrPdfFile(file: File): boolean {
  return isAcceptedPdfFile(file);
}

export function assertSupportedOcrFile(file: File): void {
  if (!isAcceptedOcrFile(file)) {
    throw new OcrExtractionError(
      "UNSUPPORTED",
      "Unsupported file type. Please upload JPG, JPEG, PNG, WEBP, or PDF.",
    );
  }
}
