import sharp from "sharp";
import type { ImageProcessResult } from "@/lib/tools/image/compress-image";

export interface ResizeImageOptions {
  width?: number;
  height?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  format?: "jpeg" | "png" | "webp";
}

function resolveOutputFormat(
  metadataFormat: string | undefined,
  requested?: "jpeg" | "png" | "webp",
): "jpeg" | "png" | "webp" {
  if (requested) {
    return requested;
  }
  if (metadataFormat === "png") return "png";
  if (metadataFormat === "webp") return "webp";
  return "jpeg";
}

export async function resizeImage(
  input: Buffer,
  options: ResizeImageOptions,
): Promise<ImageProcessResult> {
  const width = options.width ? Math.round(options.width) : undefined;
  const height = options.height ? Math.round(options.height) : undefined;

  if (!width && !height) {
    throw new Error("Provide a width or height.");
  }
  if (width !== undefined && (width < 1 || width > 10_000)) {
    throw new Error("Width must be between 1 and 10,000 pixels.");
  }
  if (height !== undefined && (height < 1 || height > 10_000)) {
    throw new Error("Height must be between 1 and 10,000 pixels.");
  }

  const image = sharp(input, { failOn: "none" }).rotate();
  const metadata = await image.metadata();
  const format = resolveOutputFormat(metadata.format, options.format);

  let pipeline = image.resize({
    width,
    height,
    fit: options.fit ?? "inside",
    withoutEnlargement: false,
  });

  if (format === "png") {
    pipeline = pipeline.png({ compressionLevel: 9, palette: false });
  } else if (format === "webp") {
    pipeline = pipeline.webp({ quality: 90 });
  } else {
    pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true });
  }

  const buffer = await pipeline.toBuffer();
  const outputMeta = await sharp(buffer).metadata();

  if (buffer.length === 0) {
    throw new Error("Resize produced an empty image.");
  }

  return {
    buffer,
    width: outputMeta.width ?? width ?? 0,
    height: outputMeta.height ?? height ?? 0,
    format,
  };
}
