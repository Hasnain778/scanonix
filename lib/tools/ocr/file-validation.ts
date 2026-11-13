import { isAcceptedPdfFile } from "../pdf-utils";
import { getAnonymousUploadLimit, validateAnonymousUploadSize } from "@/lib/plan/tool-access";
import { OcrExtractionError } from "./languages";

export const OCR_ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.pdf";

export const OCR_UNSUPPORTED_FILE_MESSAGE =
  "Unsupported file type. Please upload JPG, JPEG, PNG, WEBP, or PDF.";

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
    throw new OcrExtractionError("UNSUPPORTED", OCR_UNSUPPORTED_FILE_MESSAGE);
  }
}

/** Uses the advertised free-plan cap: 10 × 1024 × 1024 bytes. Equal size is allowed. */
export function getOcrFileSizeError(bytes: number): string | null {
  if (validateAnonymousUploadSize("ocr", bytes) === null) {
    return null;
  }

  const maxMb = Math.round(getAnonymousUploadLimit() / (1024 * 1024));
  return `This file is larger than ${maxMb} MB. Choose a JPG, JPEG, PNG, WEBP, or PDF up to ${maxMb} MB.`;
}
