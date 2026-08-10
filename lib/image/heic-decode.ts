export async function decodeHeicFile(
  file: File,
  toType: "image/jpeg" | "image/png" = "image/jpeg",
): Promise<Blob> {
  const { default: heic2any } = await import("heic2any");
  const result = await heic2any({
    blob: file,
    toType,
    quality: 0.92,
  });

  if (Array.isArray(result)) {
    return result[0];
  }

  return result;
}
