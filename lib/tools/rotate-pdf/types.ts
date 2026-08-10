export type PdfRotationDegrees = 90 | 180 | 270;

export type PdfRotateErrorCode =
  | "PASSWORD_PDF"
  | "CORRUPT_PDF"
  | "NO_PAGES"
  | "NO_PAGES_SELECTED"
  | "ROTATE_FAILED";

export class PdfRotateError extends Error {
  readonly code: PdfRotateErrorCode;

  constructor(code: PdfRotateErrorCode, message: string) {
    super(message);
    this.name = "PdfRotateError";
    this.code = code;
  }
}

export function isPasswordRelatedError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    ("name" in error || "message" in error) &&
    ((error as { name?: string }).name === "PasswordException" ||
      /password/i.test((error as { message?: string }).message ?? ""))
  );
}

export function getPdfRotateErrorMessage(error: unknown): string {
  if (error instanceof PdfRotateError) return error.message;
  if (isPasswordRelatedError(error)) {
    return "This PDF is password-protected. Remove the password and try again.";
  }
  return "Could not rotate this PDF. The file may be corrupt or unsupported.";
}
