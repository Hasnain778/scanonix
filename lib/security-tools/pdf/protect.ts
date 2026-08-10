import { encryptPDF } from "@pdfsmaller/pdf-encrypt";

export async function protectPdfWithPassword(
  buffer: Buffer,
  password: string,
): Promise<Uint8Array> {
  if (!password || password.length < 4) {
    throw new Error("Password must be at least 4 characters.");
  }

  return encryptPDF(new Uint8Array(buffer), password, {
    ownerPassword: password,
    algorithm: "AES-256",
  });
}
