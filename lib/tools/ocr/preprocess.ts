const MIN_OCR_LONG_EDGE = 1600;
const MAX_OCR_LONG_EDGE = 4000;
const MAX_OCR_PIXELS = 16_000_000;

export type OcrPreprocessProfile = "auto" | "document" | "photo";

function copyCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  const context = copy.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not supported in this browser.");
  }
  context.drawImage(source, 0, 0);
  return copy;
}

function scaleCanvas(source: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const scaled = document.createElement("canvas");
  scaled.width = width;
  scaled.height = height;

  const context = scaled.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not supported in this browser.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  return scaled;
}

function estimateDocumentLikelihood(canvas: HTMLCanvasElement): number {
  const sampleSize = 48;
  const sample = document.createElement("canvas");
  sample.width = sampleSize;
  sample.height = sampleSize;
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) return 0;

  context.drawImage(canvas, 0, 0, sampleSize, sampleSize);
  const { data } = context.getImageData(0, 0, sampleSize, sampleSize);

  let edgeCount = 0;
  let grayscaleSpread = 0;
  const grays: number[] = [];

  for (let y = 0; y < sampleSize; y += 1) {
    for (let x = 0; x < sampleSize; x += 1) {
      const index = (y * sampleSize + x) * 4;
      const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
      grays.push(gray);

      if (x > 0 && y > 0) {
        const prevIndex = (y * sampleSize + (x - 1)) * 4;
        const prevGray =
          data[prevIndex] * 0.299 + data[prevIndex + 1] * 0.587 + data[prevIndex + 2] * 0.114;
        if (Math.abs(gray - prevGray) > 28) {
          edgeCount += 1;
        }
      }
    }
  }

  const mean = grays.reduce((sum, value) => sum + value, 0) / grays.length;
  grayscaleSpread = Math.sqrt(
    grays.reduce((sum, value) => sum + (value - mean) ** 2, 0) / grays.length,
  );

  const edgeScore = edgeCount / (sampleSize * sampleSize);
  const spreadScore = Math.min(grayscaleSpread / 64, 1);
  return edgeScore * 0.65 + spreadScore * 0.35;
}

function enhancePhotoDocument(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const output = copyCanvas(canvas);
  const context = output.getContext("2d", { willReadFrequently: true });
  if (!context) return output;

  const imageData = context.getImageData(0, 0, output.width, output.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const contrast = 1.12;
    const adjusted = Math.min(255, Math.max(0, (gray - 128) * contrast + 128));
    data[index] = adjusted;
    data[index + 1] = adjusted;
    data[index + 2] = adjusted;
  }

  context.putImageData(imageData, 0, 0);
  return output;
}

function capCanvasSize(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const pixels = canvas.width * canvas.height;
  const longEdge = Math.max(canvas.width, canvas.height);

  if (pixels <= MAX_OCR_PIXELS && longEdge <= MAX_OCR_LONG_EDGE) {
    return canvas;
  }

  const pixelScale = Math.sqrt(MAX_OCR_PIXELS / pixels);
  const edgeScale = MAX_OCR_LONG_EDGE / longEdge;
  const scale = Math.min(pixelScale, edgeScale, 1);
  return scaleCanvas(canvas, scale);
}

export function preprocessCanvasForOcr(
  source: HTMLCanvasElement,
  profile: OcrPreprocessProfile = "auto",
): HTMLCanvasElement {
  let canvas = copyCanvas(source);
  const longEdge = Math.max(canvas.width, canvas.height);

  if (longEdge < MIN_OCR_LONG_EDGE) {
    canvas = scaleCanvas(canvas, MIN_OCR_LONG_EDGE / longEdge);
  }

  canvas = capCanvasSize(canvas);

  const documentScore = estimateDocumentLikelihood(canvas);
  const shouldEnhance =
    profile === "photo" || (profile === "auto" && documentScore < 0.22);

  if (shouldEnhance) {
    canvas = enhancePhotoDocument(canvas);
  }

  return canvas;
}

export function getOcrWorkerParameters(): Record<string, string> {
  return {
    tessedit_pageseg_mode: "3",
    preserve_interword_spaces: "1",
  };
}
