import jsQR from "jsqr";
import { loadImageElement } from "../image-utils";
import type { ParsedQrResult } from "./types";
import { parseQrContent } from "./parse-result";

export async function decodeQrFromFile(file: File): Promise<ParsedQrResult | null> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(objectUrl);
    const raw = decodeQrFromImageElement(image);
    return raw ? parseQrContent(raw) : null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function decodeQrFromVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): ParsedQrResult | null {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth",
  });

  if (!result?.data) {
    return null;
  }

  return parseQrContent(result.data);
}

function decodeQrFromImageElement(image: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth",
  });

  return result?.data ?? null;
}
