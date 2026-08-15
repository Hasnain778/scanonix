import { RedactPdfError, type RedactPdfErrorCode } from "./types";

export { RedactPdfError, getRedactPdfErrorMessage } from "./types";
export type { RedactPdfErrorCode } from "./types";

export function throwRedactError(code: RedactPdfErrorCode, message: string): never {
  throw new RedactPdfError(code, message);
}

export function isRedactPdfError(error: unknown): error is RedactPdfError {
  return error instanceof RedactPdfError;
}
