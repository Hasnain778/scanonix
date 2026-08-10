import type { ProcessedImage, Rotation } from "@/types/tool";
import { ACCEPTED_IMAGE_TYPES } from "@/types/tool";
import {
  ImageNormalizationError,
  normalizeFileToCanvasSafe,
  normalizeImageToCanvas,
  resolveDrawableBlob,
} from "@/lib/image/normalize";

export { createFileId as createImageId } from "@/lib/utils/format";

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

export function isAcceptedImageFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (
    ACCEPTED_IMAGE_TYPES.includes(type as (typeof ACCEPTED_IMAGE_TYPES)[number])
  ) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension === "jpg" || extension === "jpeg" || extension === "png";
}

export function isAcceptedJpegFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension === "jpg" || extension === "jpeg";
}

export async function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  try {
    const normalized = await normalizeFileToCanvasSafe(file);
    return { width: normalized.width, height: normalized.height };
  } catch (error) {
    if (error instanceof ImageNormalizationError) {
      throw error;
    }
    throw new ImageNormalizationError("Could not read image dimensions.");
  }
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create PNG image"));
        }
      },
      "image/png",
    );
  });
}

function applyRotationToCanvas(
  source: HTMLCanvasElement,
  rotation: Rotation,
  fillWhite: boolean,
): HTMLCanvasElement {
  if (rotation === 0) {
    return source;
  }

  const context = document.createElement("canvas").getContext("2d");
  if (!context) {
    throw new Error("Canvas is not supported in this browser");
  }

  const radians = (rotation * Math.PI) / 180;
  const isSideways = rotation === 90 || rotation === 270;
  const canvas = document.createElement("canvas");
  canvas.width = isSideways ? source.height : source.width;
  canvas.height = isSideways ? source.width : source.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not supported in this browser");
  }

  if (fillWhite) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(radians);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);

  return canvas;
}

export function rotateImageOnCanvas(
  image: HTMLImageElement,
  rotation: Rotation,
): ProcessedImage {
  const temp = document.createElement("canvas");
  temp.width = image.naturalWidth;
  temp.height = image.naturalHeight;
  const tempContext = temp.getContext("2d");
  if (!tempContext) {
    throw new Error("Canvas is not supported in this browser");
  }
  tempContext.drawImage(image, 0, 0);

  const isPng =
    image.src.startsWith("data:image/png") || image.src.includes("image/png");
  const rotated = applyRotationToCanvas(temp, rotation, !isPng);

  const dataUrl = isPng
    ? rotated.toDataURL("image/png")
    : rotated.toDataURL("image/jpeg", 0.95);

  return {
    dataUrl,
    widthPx: rotated.width,
    heightPx: rotated.height,
    format: isPng ? "PNG" : "JPEG",
  };
}

export async function processImageFile(
  file: File,
  rotation: Rotation,
): Promise<ProcessedImage> {
  const isPng =
    file.type === "image/png" || file.name.toLowerCase().endsWith(".png");

  const normalized = await normalizeImageToCanvas(await resolveDrawableBlob(file));
  const rotated = applyRotationToCanvas(normalized.canvas, rotation, !isPng);

  if (isPng) {
    return {
      dataUrl: rotated.toDataURL("image/png"),
      widthPx: rotated.width,
      heightPx: rotated.height,
      format: "PNG",
    };
  }

  return {
    dataUrl: rotated.toDataURL("image/jpeg", 0.95),
    widthPx: rotated.width,
    heightPx: rotated.height,
    format: "JPEG",
  };
}
