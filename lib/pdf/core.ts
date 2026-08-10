import { PDFDocument } from "pdf-lib";

export const ACCEPTED_PDF_TYPE = "application/pdf";
export const ACCEPTED_PDF_EXTENSION = ".pdf";

export class PdfLoadError extends Error {
  readonly code: "PASSWORD" | "CORRUPT";

  constructor(code: "PASSWORD" | "CORRUPT", message: string) {
    super(message);
    this.name = "PdfLoadError";
    this.code = code;
  }
}

function isPasswordProtectedPdfError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { name?: string; message?: string };
  return (
    maybeError.name === "PasswordException" ||
    /password|encrypt/i.test(maybeError.message ?? "")
  );
}

export function isAcceptedPdfFile(file: File): boolean {
  if (file.type === ACCEPTED_PDF_TYPE) return true;
  return file.name.toLowerCase().endsWith(".pdf");
}

export async function loadPdfDocument(bytes: ArrayBuffer) {
  try {
    return await PDFDocument.load(bytes);
  } catch (error) {
    if (isPasswordProtectedPdfError(error)) {
      throw new PdfLoadError(
        "PASSWORD",
        "This PDF is password-protected. Remove the password and try again.",
      );
    }

    throw new PdfLoadError(
      "CORRUPT",
      "Could not read this PDF. The file may be corrupt or unsupported.",
    );
  }
}

export async function getPdfPageCount(file: File): Promise<number> {
  const bytes = await file.arrayBuffer();
  return getPdfPageCountFromBytes(bytes);
}

export async function getPdfPageCountFromBytes(bytes: ArrayBuffer): Promise<number> {
  const pdf = await loadPdfDocument(bytes);
  return pdf.getPageCount();
}

export async function readPdfBytes(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

export { isPasswordProtectedPdfError };
