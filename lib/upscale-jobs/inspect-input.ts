import sharp from "sharp";

export const UPSCALE_MAX_OUTPUT_DIMENSION = 16_384;
export const UPSCALE_MAX_INPUT_PIXELS = 4_000_000;

export interface InspectedUpscaleInput {
  width: number;
  height: number;
}

export async function inspectUpscaleInput(
  buffer: Buffer,
  scale: 2 | 4,
): Promise<InspectedUpscaleInput> {
  let width = 0;
  let height = 0;
  try {
    const inputMeta = await sharp(buffer, { failOn: "none" }).metadata();
    width = inputMeta.width ?? 0;
    height = inputMeta.height ?? 0;
  } catch {
    throw new Error("Could not read image dimensions.");
  }

  if (width <= 0 || height <= 0) {
    throw new Error("Could not read image dimensions.");
  }

  const outputWidth = width * scale;
  const outputHeight = height * scale;
  if (outputWidth > UPSCALE_MAX_OUTPUT_DIMENSION || outputHeight > UPSCALE_MAX_OUTPUT_DIMENSION) {
    throw new Error("Upscaled output would exceed the maximum supported dimensions.");
  }

  if (width * height > UPSCALE_MAX_INPUT_PIXELS) {
    throw new Error("Image is too large to upscale safely on this server.");
  }

  return { width, height };
}
