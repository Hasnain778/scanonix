import sharp from "sharp";
import {
  MAX_ACCEPTED_LONG_EDGE,
  MAX_ACCEPTED_PIXELS,
} from "@/lib/tools/background-remover/processing-limits";

export interface PreparedProcessingInput {
  buffer: Buffer;
  mimeType: string;
  originalWidth: number;
  originalHeight: number;
  processedWidth: number;
  processedHeight: number;
  wasOptimized: boolean;
}

export class BackgroundRemoverProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackgroundRemoverProcessingError";
  }
}

/** Downscale oversized inputs for rembg. Never enlarges — preserves aspect ratio. */
export async function prepareProcessingInput(
  input: Buffer,
  mimeType: string,
  processingMaxLongEdge: number,
): Promise<PreparedProcessingInput> {
  const meta = await sharp(input, { failOn: "none" }).metadata();
  const originalWidth = meta.width ?? 0;
  const originalHeight = meta.height ?? 0;

  if (originalWidth <= 0 || originalHeight <= 0) {
    throw new BackgroundRemoverProcessingError(
      "Could not read image dimensions. The file may be corrupt or unsupported.",
    );
  }

  const longEdge = Math.max(originalWidth, originalHeight);
  const pixels = originalWidth * originalHeight;

  if (longEdge > MAX_ACCEPTED_LONG_EDGE || pixels > MAX_ACCEPTED_PIXELS) {
    throw new BackgroundRemoverProcessingError(
      "Image exceeds the maximum supported resolution for safe server processing.",
    );
  }

  if (longEdge <= processingMaxLongEdge) {
    return {
      buffer: input,
      mimeType,
      originalWidth,
      originalHeight,
      processedWidth: originalWidth,
      processedHeight: originalHeight,
      wasOptimized: false,
    };
  }

  const scale = processingMaxLongEdge / longEdge;
  const targetWidth = Math.max(1, Math.round(originalWidth * scale));
  const targetHeight = Math.max(1, Math.round(originalHeight * scale));

  const buffer = await sharp(input, { failOn: "none" })
    .resize(targetWidth, targetHeight, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 6 })
    .toBuffer();

  const outMeta = await sharp(buffer).metadata();

  return {
    buffer,
    mimeType: "image/png",
    originalWidth,
    originalHeight,
    processedWidth: outMeta.width ?? targetWidth,
    processedHeight: outMeta.height ?? targetHeight,
    wasOptimized: true,
  };
}
