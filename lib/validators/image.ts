import { ACCEPTED_IMAGE_TYPES } from "@/types/tool";
import {
  isAcceptedImageFile,
  isAcceptedJpegFile,
} from "@/lib/image/processing";

export { isAcceptedImageFile, isAcceptedJpegFile };

export function validateImageFile(file: File): string | null {
  if (!isAcceptedImageFile(file)) {
    return "Please upload a JPG, JPEG, or PNG image.";
  }
  if (file.size === 0) {
    return "The file is empty.";
  }
  return null;
}

export function validateImageType(file: File): string | null {
  const type = file.type.toLowerCase();
  if (
    !ACCEPTED_IMAGE_TYPES.includes(
      type as (typeof ACCEPTED_IMAGE_TYPES)[number],
    ) &&
    !isAcceptedImageFile(file)
  ) {
    return "Unsupported image format.";
  }
  return null;
}

export function validateImageSize(file: File, maxMb = 50): string | null {
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return `Image exceeds the ${maxMb} MB limit.`;
  }
  return null;
}
