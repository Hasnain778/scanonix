import sharp from "sharp";

export interface CompressImageOptions {
  quality: number;
  format?: "jpeg" | "png" | "webp";
  preserveInputFormat?: boolean;
}

export interface ImageProcessResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
}

function resolveOutputFormat(
  metadataFormat: string | undefined,
  requested?: "jpeg" | "png" | "webp",
  preserveInputFormat = true,
): "jpeg" | "png" | "webp" {
  if (requested) {
    return requested;
  }

  if (preserveInputFormat) {
    if (metadataFormat === "png") return "png";
    if (metadataFormat === "webp") return "webp";
  }

  return "jpeg";
}

export async function compressImage(
  input: Buffer,
  options: CompressImageOptions,
): Promise<ImageProcessResult> {
  const quality = Math.min(100, Math.max(1, Math.round(options.quality)));
  const base = sharp(input, { failOn: "none" }).rotate();
  const metadata = await base.metadata();
  const format = resolveOutputFormat(
    metadata.format,
    options.format,
    options.preserveInputFormat !== false,
  );

  let pipeline = base;

  if (format === "png") {
    pipeline = pipeline.png({
      compressionLevel: 9,
      palette: false,
    });
  } else if (format === "webp") {
    pipeline = pipeline.webp({ quality });
  } else {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  }

  const buffer = await pipeline.toBuffer();
  const outputMeta = await sharp(buffer).metadata();

  if (buffer.length === 0) {
    throw new Error("Compression produced an empty image.");
  }

  return {
    buffer,
    width: outputMeta.width ?? metadata.width ?? 0,
    height: outputMeta.height ?? metadata.height ?? 0,
    format,
  };
}
