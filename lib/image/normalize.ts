import { decodeHeicFile } from "@/lib/image/heic-decode";
import { isHeicFile } from "@/lib/image/formats";
import { loadImageElement } from "@/lib/image/processing";

export interface NormalizedImage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export class ImageNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageNormalizationError";
  }
}

async function createOrientedBitmap(source: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== "function") {
    throw new ImageNormalizationError("This browser cannot decode images for processing.");
  }

  try {
    return await createImageBitmap(source, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(source);
  }
}

function drawBitmapToCanvas(bitmap: ImageBitmap): NormalizedImage {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new ImageNormalizationError("Canvas is not supported in this browser.");
  }

  context.drawImage(bitmap, 0, 0);

  return {
    canvas,
    width: canvas.width,
    height: canvas.height,
  };
}

/** Decode HEIC/HEIF to a browser-decodable blob when needed. */
export async function resolveDrawableBlob(file: File): Promise<Blob> {
  if (isHeicFile(file)) {
    return decodeHeicFile(file);
  }
  return file;
}

/** Apply EXIF orientation and return a canvas at full decoded resolution. */
export async function normalizeImageToCanvas(source: Blob): Promise<NormalizedImage> {
  if (source.size === 0) {
    throw new ImageNormalizationError("Image file is empty.");
  }

  const bitmap = await createOrientedBitmap(source);

  try {
    if (bitmap.width === 0 || bitmap.height === 0) {
      throw new ImageNormalizationError("Image has invalid dimensions.");
    }

    return drawBitmapToCanvas(bitmap);
  } finally {
    bitmap.close();
  }
}

export async function normalizeFileToCanvas(file: File): Promise<NormalizedImage> {
  const drawable = await resolveDrawableBlob(file);
  return normalizeImageToCanvas(drawable);
}

export async function getNormalizedDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  const { width, height } = await normalizeFileToCanvas(file);
  return { width, height };
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) {
          reject(new ImageNormalizationError(`Failed to encode ${mimeType} output.`));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

/** Produce an orientation-correct PNG blob for downstream tools (OCR, background removal, etc.). */
export async function normalizeFileToPngBlob(file: File): Promise<Blob> {
  const { canvas } = await normalizeFileToCanvas(file);
  return canvasToBlob(canvas, "image/png");
}

async function normalizeWithFallback(source: Blob): Promise<NormalizedImage> {
  try {
    return await normalizeImageToCanvas(source);
  } catch {
    const objectUrl = URL.createObjectURL(source);
    try {
      const image = await loadImageElement(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new ImageNormalizationError("Canvas is not supported in this browser.");
      }
      context.drawImage(image, 0, 0);
      return { canvas, width: canvas.width, height: canvas.height };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

export async function normalizeFileToCanvasSafe(file: File): Promise<NormalizedImage> {
  const drawable = await resolveDrawableBlob(file);
  return normalizeWithFallback(drawable);
}
