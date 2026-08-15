import {
  AlreadyEncryptedError,
  encryptPDF,
  PasswordEncodingError,
} from "@pdfsmaller/pdf-encrypt";

export type ProtectPdfErrorCode =
  | "EMPTY_PASSWORD"
  | "PASSWORD_TOO_SHORT"
  | "ALREADY_ENCRYPTED"
  | "PASSWORD_ENCODING"
  | "INVALID_PDF"
  | "ENCRYPTION_FAILED";

export class ProtectPdfError extends Error {
  readonly code: ProtectPdfErrorCode;

  constructor(code: ProtectPdfErrorCode, message: string) {
    super(message);
    this.name = "ProtectPdfError";
    this.code = code;
  }
}

export async function protectPdfWithPassword(
  buffer: Buffer,
  password: string,
): Promise<Uint8Array> {
  if (!password) {
    throw new ProtectPdfError("EMPTY_PASSWORD", "Enter a password.");
  }

  if (password.length < 4) {
    throw new ProtectPdfError(
      "PASSWORD_TOO_SHORT",
      "Password must be at least 4 characters.",
    );
  }

  try {
    return await encryptPDF(new Uint8Array(buffer), password, {
      ownerPassword: password,
      algorithm: "AES-256",
    });
  } catch (error) {
    if (error instanceof AlreadyEncryptedError) {
      throw new ProtectPdfError(
        "ALREADY_ENCRYPTED",
        "This PDF is already password-protected. Unlock it first, then protect again.",
      );
    }

    if (error instanceof PasswordEncodingError) {
      throw new ProtectPdfError(
        "PASSWORD_ENCODING",
        "This password contains characters that cannot be used for AES-256 encryption. Try a simpler password.",
      );
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (
        message.includes("invalid pdf") ||
        message.includes("failed to parse") ||
        message.includes("not a pdf") ||
        message.includes("no pdf header")
      ) {
        throw new ProtectPdfError("INVALID_PDF", "The uploaded file is not a valid PDF.");
      }
    }

    throw new ProtectPdfError(
      "ENCRYPTION_FAILED",
      error instanceof Error ? error.message : "Could not protect PDF.",
    );
  }
}
