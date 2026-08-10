import { canvasToPngBlob, loadImageElement } from "../image-utils";
import type { BackgroundPreviewMode } from "./types";

export function resolveBackgroundColor(
  mode: BackgroundPreviewMode,
  customColor: string,
): string | null {
  switch (mode) {
    case "transparent":
      return null;
    case "white":
      return "#ffffff";
    case "black":
      return "#000000";
    case "custom":
      return customColor;
  }
}

export async function compositeBackgroundOnBlob(
  transparentBlob: Blob,
  backgroundColor: string | null,
): Promise<Blob> {
  if (!backgroundColor) {
    return transparentBlob;
  }

  const objectUrl = URL.createObjectURL(transparentBlob);

  try {
    const image = await loadImageElement(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is not supported in this browser");
    }

    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);

    return canvasToPngBlob(canvas);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
