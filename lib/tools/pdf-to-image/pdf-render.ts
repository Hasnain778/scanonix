import { configurePdfWorker } from "@/lib/pdf/configure-worker";
import type { ImageExportFormat, ImageExportQuality, ImageExportScale } from "../types";

const BASE_RENDER_SCALE = 1.5;

export function getRenderScale(scale: ImageExportScale): number {
  return BASE_RENDER_SCALE * scale;
}

export function getMimeType(format: ImageExportFormat): string {
  switch (format) {
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
  }
}

export function getQualityValue(
  format: ImageExportFormat,
  quality: ImageExportQuality,
): number | undefined {
  if (format === "png") {
    return undefined;
  }

  const values: Record<ImageExportQuality, number> = {
    standard: 0.85,
    high: 0.92,
    maximum: 0.98,
  };

  return values[quality];
}

export async function loadPdfDocument(pdfBytes: ArrayBuffer) {
  await configurePdfWorker();
  const pdfjs = await import("pdfjs-dist");
  const data = pdfBytes.slice(0);
  return pdfjs.getDocument({ data }).promise;
}

export async function renderPdfPageToCanvasFromDoc(
  pdf: Awaited<ReturnType<typeof loadPdfDocument>>,
  pageNumber: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not supported in this browser");
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvas, canvasContext: context, viewport }).promise;

  return canvas;
}

export async function renderPdfPageToCanvas(
  pdfBytes: ArrayBuffer,
  pageNumber: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const pdf = await loadPdfDocument(pdfBytes);
  return renderPdfPageToCanvasFromDoc(pdf, pageNumber, scale);
}

export async function canvasToImageBlob(
  canvas: HTMLCanvasElement,
  format: ImageExportFormat,
  quality: ImageExportQuality,
): Promise<Blob> {
  const mimeType = getMimeType(format);
  const qualityValue = getQualityValue(format, quality);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error(`Failed to create ${format.toUpperCase()} image`));
        }
      },
      mimeType,
      qualityValue,
    );
  });
}

export async function renderPagePreviewDataUrl(
  pdfBytes: ArrayBuffer,
  pageNumber: number,
  previewScale = 0.35,
): Promise<string> {
  const canvas = await renderPdfPageToCanvas(pdfBytes, pageNumber, previewScale);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
  return dataUrl;
}
