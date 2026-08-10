import { canvasToPngBlob, loadImageElement } from "../image-utils";

export interface TransparencyAnalysis {
  transparentRatio: number;
  subjectRatio: number;
  likelyNoSubject: boolean;
}

export async function analyzeTransparentBlob(
  blob: Blob,
): Promise<TransparencyAnalysis> {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImageElement(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is not supported in this browser");
    }

    context.drawImage(image, 0, 0);

    const { data, width, height } = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const totalPixels = width * height;
    let transparentPixels = 0;
    let subjectPixels = 0;

    for (let index = 3; index < data.length; index += 4) {
      const alpha = data[index];
      if (alpha < 32) {
        transparentPixels += 1;
      } else if (alpha > 200) {
        subjectPixels += 1;
      }
    }

    const transparentRatio = transparentPixels / totalPixels;
    const subjectRatio = subjectPixels / totalPixels;
    const likelyNoSubject =
      transparentRatio < 0.05 ||
      subjectRatio < 0.02 ||
      transparentRatio > 0.98;

    return {
      transparentRatio,
      subjectRatio,
      likelyNoSubject,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function blobToPreviewUrl(blob: Blob): Promise<string> {
  return URL.createObjectURL(blob);
}

export { canvasToPngBlob };
