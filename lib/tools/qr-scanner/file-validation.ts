export const ACCEPTED_QR_SCANNER_EXTENSIONS = ".jpg,.jpeg,.png,.webp";

export const ACCEPTED_QR_SCANNER_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const MAX_QR_SCANNER_BYTES = 25 * 1024 * 1024;

export function isAcceptedQrScannerFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (
    ACCEPTED_QR_SCANNER_TYPES.includes(
      type as (typeof ACCEPTED_QR_SCANNER_TYPES)[number],
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

export function validateQrScannerFile(file: File): string | null {
  if (!isAcceptedQrScannerFile(file)) {
    return "Unsupported file type. Please upload a JPG, JPEG, PNG, or WEBP image.";
  }

  if (file.size > MAX_QR_SCANNER_BYTES) {
    return "This image is too large. Please use an image under 25 MB.";
  }

  return null;
}
