import type { ImageFormatId } from "@/constants/image-tools";

export class ImageBinaryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageBinaryValidationError";
  }
}

function readHeaderBytes(blob: Blob, length: number): Promise<Uint8Array> {
  return blob.slice(0, length).arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

function matchesJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function matchesPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function matchesWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

export function detectBytesImageFormat(bytes: Uint8Array): ImageFormatId | null {
  if (matchesPng(bytes)) return "png";
  if (matchesJpeg(bytes)) return "jpg";
  if (matchesWebp(bytes)) return "webp";
  return null;
}

export function assertBufferMatchesFormat(buffer: Buffer, expected: ImageFormatId): void {
  if (buffer.length === 0) {
    throw new ImageBinaryValidationError("Output image is empty.");
  }

  const detected = detectBytesImageFormat(buffer);
  if (!detected) {
    throw new ImageBinaryValidationError("Output is not a recognized image format.");
  }

  if (detected !== expected) {
    throw new ImageBinaryValidationError(
      `Output format mismatch: expected ${expected.toUpperCase()}, got ${detected.toUpperCase()}.`,
    );
  }
}

export async function detectBlobImageFormat(blob: Blob): Promise<ImageFormatId | null> {
  const header = await readHeaderBytes(blob, 12);

  return detectBytesImageFormat(header);
}

export async function assertBlobMatchesFormat(
  blob: Blob,
  expected: ImageFormatId,
): Promise<void> {
  if (blob.size === 0) {
    throw new ImageBinaryValidationError("Output image is empty.");
  }

  const detected = await detectBlobImageFormat(blob);
  if (!detected) {
    throw new ImageBinaryValidationError("Output is not a recognized image format.");
  }

  if (detected !== expected) {
    throw new ImageBinaryValidationError(
      `Output format mismatch: expected ${expected.toUpperCase()}, got ${detected.toUpperCase()}.`,
    );
  }
}

export function assertPdfBytes(bytes: Uint8Array): void {
  if (bytes.byteLength < 5) {
    throw new Error("Output PDF is empty or too small.");
  }

  const header = String.fromCharCode(...bytes.slice(0, 5));
  if (!header.startsWith("%PDF-")) {
    throw new Error("Output is not a valid PDF file.");
  }
}

export function assertDocxBytes(bytes: Uint8Array): void {
  if (bytes.byteLength < 4) {
    throw new Error("Output DOCX is empty or too small.");
  }

  const isZip =
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
    (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08);

  if (!isZip) {
    throw new Error("Output is not a valid DOCX file.");
  }
}
