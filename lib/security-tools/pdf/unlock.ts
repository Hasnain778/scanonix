import { decryptPDF } from "@pdfsmaller/pdf-decrypt";

export async function unlockPdfWithPassword(
  buffer: Buffer,
  password: string,
): Promise<Uint8Array> {
  if (!password) {
    throw new Error("Enter the PDF password to unlock.");
  }

  try {
    return await decryptPDF(new Uint8Array(buffer), password);
  } catch {
    throw new Error("Incorrect password or unsupported encryption.");
  }
}
