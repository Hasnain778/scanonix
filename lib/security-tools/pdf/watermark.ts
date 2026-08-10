import { degrees, PDFDocument, rgb, type Rotation } from "pdf-lib";

export type WatermarkPosition =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "diagonal";

export interface WatermarkOptions {
  text?: string;
  imageBytes?: Buffer;
  position: WatermarkPosition;
  opacity: number;
  fontSize: number;
  pageSelection: "all" | number[];
}

function resolvePosition(
  position: WatermarkPosition,
  pageWidth: number,
  pageHeight: number,
  contentWidth: number,
  contentHeight: number,
): { x: number; y: number; rotate: Rotation } {
  const margin = 24;

  switch (position) {
    case "top-left":
      return { x: margin, y: pageHeight - contentHeight - margin, rotate: degrees(0) };
    case "top-right":
      return {
        x: pageWidth - contentWidth - margin,
        y: pageHeight - contentHeight - margin,
        rotate: degrees(0),
      };
    case "bottom-left":
      return { x: margin, y: margin, rotate: degrees(0) };
    case "bottom-right":
      return {
        x: pageWidth - contentWidth - margin,
        y: margin,
        rotate: degrees(0),
      };
    case "diagonal":
      return {
        x: pageWidth / 2 - contentWidth / 2,
        y: pageHeight / 2 - contentHeight / 2,
        rotate: degrees(-45),
      };
    case "center":
    default:
      return {
        x: pageWidth / 2 - contentWidth / 2,
        y: pageHeight / 2 - contentHeight / 2,
        rotate: degrees(0),
      };
  }
}

function resolvePageIndices(totalPages: number, selection: "all" | number[]): number[] {
  if (selection === "all") {
    return Array.from({ length: totalPages }, (_, index) => index);
  }

  return selection.filter((index) => index >= 0 && index < totalPages);
}

export async function watermarkPdf(
  buffer: Buffer,
  options: WatermarkOptions,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const pageIndices = resolvePageIndices(pages.length, options.pageSelection);
  const opacity = Math.min(1, Math.max(0.05, options.opacity));

  let embeddedImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  if (options.imageBytes) {
    try {
      embeddedImage = await pdfDoc.embedPng(options.imageBytes);
    } catch {
      embeddedImage = await pdfDoc.embedJpg(options.imageBytes);
    }
  }

  const text = options.text?.trim();
  if (!text && !embeddedImage) {
    throw new Error("Provide watermark text or an image.");
  }

  for (const pageIndex of pageIndices) {
    const page = pages[pageIndex];
    if (!page) continue;

    const { width, height } = page.getSize();

    if (embeddedImage) {
      const scale = Math.min(width * 0.4 / embeddedImage.width, height * 0.4 / embeddedImage.height);
      const imgWidth = embeddedImage.width * scale;
      const imgHeight = embeddedImage.height * scale;
      const { x, y, rotate } = resolvePosition(
        options.position,
        width,
        height,
        imgWidth,
        imgHeight,
      );

      page.drawImage(embeddedImage, {
        x,
        y,
        width: imgWidth,
        height: imgHeight,
        rotate,
        opacity,
      });
    }

    if (text) {
      const fontSize = options.fontSize;
      const textWidth = text.length * fontSize * 0.5;
      const textHeight = fontSize;
      const { x, y, rotate } = resolvePosition(
        options.position,
        width,
        height,
        textWidth,
        textHeight,
      );

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        rotate,
        opacity,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
  }

  return pdfDoc.save();
}

export function parsePageSelection(raw: string | null, totalPages: number): "all" | number[] {
  if (!raw || raw.trim() === "" || raw.trim().toLowerCase() === "all") {
    return "all";
  }

  const indices = raw
    .split(",")
    .map((part) => Number(part.trim()) - 1)
    .filter((index) => !Number.isNaN(index) && index >= 0 && index < totalPages);

  return indices.length > 0 ? indices : "all";
}
