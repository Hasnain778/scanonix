import { decryptPDF } from "@pdfsmaller/pdf-decrypt";

export type UnlockPdfErrorCode =
  | "WRONG_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_PAGES"
  | "CORRUPT_PDF"
  | "NOT_ENCRYPTED"
  | "INCORRECT_PASSWORD"
  | "UNSUPPORTED_ENCRYPTION"
  | "EMPTY_PASSWORD"
  | "DECRYPTION_FAILED"
  | "INTERNAL_ERROR";

export class UnlockPdfError extends Error {
  readonly code: UnlockPdfErrorCode;

  constructor(code: UnlockPdfErrorCode, message: string) {
    super(message);
    this.name = "UnlockPdfError";
    this.code = code;
  }
}

function isPdfHeader(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function mapDecryptError(error: unknown): never {
  if (error instanceof UnlockPdfError) {
    throw error;
  }

  if (error instanceof Error) {
    const message = error.message;

    if (message.includes("not encrypted")) {
      throw new UnlockPdfError(
        "NOT_ENCRYPTED",
        "This PDF is not password-protected.",
      );
    }

    if (message.includes("Incorrect password")) {
      throw new UnlockPdfError(
        "INCORRECT_PASSWORD",
        "Incorrect password. Enter the current PDF password to unlock.",
      );
    }

    if (message.includes("Unsupported encryption")) {
      throw new UnlockPdfError(
        "UNSUPPORTED_ENCRYPTION",
        "This PDF uses an encryption type that cannot be unlocked here.",
      );
    }

    const lower = message.toLowerCase();
    if (
      lower.includes("invalid pdf") ||
      lower.includes("failed to parse") ||
      lower.includes("not a pdf") ||
      lower.includes("no pdf header") ||
      lower.includes("failed to decrypt pdf")
    ) {
      throw new UnlockPdfError("CORRUPT_PDF", "The uploaded file is not a valid PDF.");
    }
  }

  throw new UnlockPdfError(
    "DECRYPTION_FAILED",
    error instanceof Error ? error.message : "Could not unlock PDF.",
  );
}

export async function unlockPdfWithPassword(
  buffer: Buffer,
  password: string,
): Promise<Uint8Array> {
  if (!isPdfHeader(buffer)) {
    throw new UnlockPdfError("CORRUPT_PDF", "The uploaded file is not a valid PDF.");
  }

  try {
    return await decryptPDF(new Uint8Array(buffer), password);
  } catch (error) {
    mapDecryptError(error);
  }
}
