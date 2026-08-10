import sharp from "sharp";
import type { ImageProcessResult } from "@/lib/tools/image/compress-image";

export type UpscaleFactor = 2 | 4;

export async function upscaleImage(
  input: Buffer,
  factor: UpscaleFactor,
): Promise<ImageProcessResult> {
  const image = sharp(input, { failOn: "none" });
  const metadata = await image.metadata();

  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;

  if (originalWidth <= 0 || originalHeight <= 0) {
    throw new Error("Could not read image dimensions.");
  }

  const targetWidth = originalWidth * factor;
  const targetHeight = originalHeight * factor;

  if (targetWidth > 16_384 || targetHeight > 16_384) {
    throw new Error("Upscaled image would exceed the maximum supported dimensions.");
  }

  const format = metadata.format === "png" ? "png" : "jpeg";

  let pipeline = image.resize(targetWidth, targetHeight, {
    kernel: sharp.kernel.lanczos3,
    fit: "fill",
  });

  if (format === "png") {
    pipeline = pipeline.png({ compressionLevel: 6 });
  } else {
    pipeline = pipeline.jpeg({ quality: 92, mozjpeg: true });
  }

  const buffer = await pipeline.toBuffer();

  return {
    buffer,
    width: targetWidth,
    height: targetHeight,
    format,
  };
}
