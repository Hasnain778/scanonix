import { getImageDimensions } from "../image-utils";
import { BackgroundRemoverError } from "./types";

export const ACCEPTED_BACKGROUND_REMOVER_EXTENSIONS =
  ".jpg,.jpeg,.png,.webp";

export const ACCEPTED_BACKGROUND_REMOVER_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const MAX_BACKGROUND_REMOVER_BYTES = 25 * 1024 * 1024;

export function isAcceptedBackgroundRemoverFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (
    ACCEPTED_BACKGROUND_REMOVER_TYPES.includes(
      type as (typeof ACCEPTED_BACKGROUND_REMOVER_TYPES)[number],
    )
  ) {
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

export function getBackgroundRemoverFileError(file: File): string | null {
  if (!isAcceptedBackgroundRemoverFile(file)) {
    return "Unsupported file type. Please upload a JPG, JPEG, PNG, or WEBP image.";
  }

  if (file.size > MAX_BACKGROUND_REMOVER_BYTES) {
    return "This image is too large. Please use an image under 25 MB.";
  }

  return null;
}

export function canAcceptBackgroundRemoverFile(file: File): boolean {
  return getBackgroundRemoverFileError(file) === null;
}

/** Validates type/size and reads dimensions. Large images are accepted — server optimizes them. */
export async function validateBackgroundRemoverFile(file: File): Promise<{
  width: number;
  height: number;
}> {
  if (!isAcceptedBackgroundRemoverFile(file)) {
    throw new BackgroundRemoverError(
      "UNSUPPORTED",
      "Unsupported file type. Please upload a JPG, JPEG, PNG, or WEBP image.",
    );
  }

  if (file.size > MAX_BACKGROUND_REMOVER_BYTES) {
    throw new BackgroundRemoverError(
      "TOO_LARGE",
      "This image is too large. Please use an image under 25 MB.",
    );
  }

  let width: number;
  let height: number;

  try {
    ({ width, height } = await getImageDimensions(file));
  } catch {
    throw new BackgroundRemoverError(
      "FAILURE",
      "Could not read this image. The file may be corrupt or unsupported.",
    );
  }

  if (width === 0 || height === 0) {
    throw new BackgroundRemoverError(
      "FAILURE",
      "This image appears to be empty or unreadable.",
    );
  }

  return { width, height };
}
