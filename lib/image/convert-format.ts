import type { ImageFormatId } from "@/constants/image-tools";
import {
  formatHasPotentialTransparency,
  isHeicFile,
  outputExtension,
  outputSupportsTransparency,
} from "@/lib/image/formats";
import { decodeHeicFile } from "@/lib/image/heic-decode";
import {
  canvasToBlob,
  ImageNormalizationError,
  normalizeFileToCanvas,
  normalizeImageToCanvas,
  resolveDrawableBlob,
} from "@/lib/image/normalize";
import { canvasToPngBlob } from "@/lib/image/processing";
import { assertBlobMatchesFormat, ImageBinaryValidationError } from "@/lib/image/validate-binary";
import type { ImageOutput } from "@/types/tool";

export interface ConvertImageOptions {
  from: ImageFormatId;
  to: ImageFormatId;
  quality?: number;
  backgroundColor?: string;
}

async function fileToDrawableBlob(
  file: File,
  from: ImageFormatId,
  to: ImageFormatId,
): Promise<Blob> {
  if (from === "heic" || isHeicFile(file)) {
    const decodeAsPng = to === "png" || to === "webp";
    return decodeHeicFile(file, decodeAsPng ? "image/png" : "image/jpeg");
  }
  return file;
}

function sampleTransparency(canvas: HTMLCanvasElement): boolean {
  const sampleWidth = Math.min(canvas.width, 64);
  const sampleHeight = Math.min(canvas.height, 64);
  const sample = document.createElement("canvas");
  sample.width = sampleWidth;
  sample.height = sampleHeight;

  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) return false;

  context.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
  const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);

  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 250) return true;
  }

  return false;
}

export async function convertImageFile(
  file: File,
  options: ConvertImageOptions,
): Promise<{ blob: Blob; hadTransparency: boolean }> {
  const drawableBlob = await fileToDrawableBlob(file, options.from, options.to);
  let normalized;

  try {
    normalized = await normalizeImageToCanvas(drawableBlob);
  } catch (error) {
    throw error instanceof ImageNormalizationError
      ? error
      : new ImageNormalizationError("Could not decode the source image.");
  }

  const { canvas } = normalized;
  const hadTransparency =
    formatHasPotentialTransparency(options.from) && sampleTransparency(canvas);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new ImageNormalizationError("Canvas is not supported in this browser.");
  }

  const needsBackground =
    options.to === "jpg" ||
    (hadTransparency && !outputSupportsTransparency(options.to));

  if (needsBackground) {
    const flat = document.createElement("canvas");
    flat.width = canvas.width;
    flat.height = canvas.height;
    const flatContext = flat.getContext("2d");
    if (!flatContext) {
      throw new ImageNormalizationError("Canvas is not supported in this browser.");
    }
    flatContext.fillStyle = options.backgroundColor ?? "#ffffff";
    flatContext.fillRect(0, 0, flat.width, flat.height);
    flatContext.drawImage(canvas, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(flat, 0, 0);
  }

  const quality = options.quality ?? 0.92;
  let blob: Blob;

  try {
    switch (options.to) {
      case "png":
        blob = await canvasToPngBlob(canvas);
        await assertBlobMatchesFormat(blob, "png");
        break;
      case "jpg":
        blob = await canvasToBlob(canvas, "image/jpeg", quality);
        await assertBlobMatchesFormat(blob, "jpg");
        break;
      case "webp":
        blob = await canvasToBlob(canvas, "image/webp", quality);
        await assertBlobMatchesFormat(blob, "webp");
        break;
      default:
        throw new ImageNormalizationError("Unsupported output format.");
    }
  } catch (error) {
    if (error instanceof ImageBinaryValidationError) {
      throw error;
    }
    throw new ImageNormalizationError(
      error instanceof Error ? error.message : "Image conversion failed.",
    );
  }

  return { blob, hadTransparency };
}

export async function convertImageFiles(
  files: File[],
  options: ConvertImageOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<ImageOutput[]> {
  const outputs: ImageOutput[] = [];

  for (let index = 0; index < files.length; index++) {
    onProgress?.(index + 1, files.length);
    const { blob } = await convertImageFile(files[index], options);
    const baseName = files[index].name.replace(/\.[^.]+$/, "");
    outputs.push({
      filename: `${baseName}.${outputExtension(options.to)}`,
      blob,
    });
  }

  return outputs;
}

export async function detectTransparencyForFiles(
  files: File[],
  from: ImageFormatId,
): Promise<boolean> {
  if (!formatHasPotentialTransparency(from)) return false;

  for (const file of files) {
    const drawableBlob = await fileToDrawableBlob(file, from, from);
    try {
      const normalized = await normalizeImageToCanvas(drawableBlob);
      if (sampleTransparency(normalized.canvas)) return true;
    } catch {
      continue;
    }
  }

  return false;
}

/** Used by OCR and other tools that need an orientation-correct canvas. */
export async function normalizeUploadedImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  const drawable = await resolveDrawableBlob(file);
  const normalized = await normalizeImageToCanvas(drawable);
  return normalized.canvas;
}

export async function normalizeUploadedFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const normalized = await normalizeFileToCanvas(file);
  return normalized.canvas;
}
