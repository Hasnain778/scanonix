/**
 * Local first-page thumbnail for the TIFF converter workspace.
 *
 * UTIF2 has no subsampled decode. A preview uses the same preflight as
 * conversion, then decodeTiffToCanvas, then an immediate downscale. The
 * full-resolution canvas is released before the thumbnail blob is retained.
 *
 * inspectTiffFile is the only size gate. It already enforces TIFF_MAX_EDGE
 * and TIFF_MAX_DECODED_PIXELS. A separate preview refusal is not used.
 *
 * 5760×3240 is 18,662,400 pixels. The decoded RGBA buffer is 74,649,600
 * bytes, and the full canvas is the same order. That file is inside the
 * 8192×8192 conversion ceiling, so its thumbnail is allowed. Peak memory
 * matches one conversion decode. The retained thumbnail is a PNG whose
 * long edge is at most TIFF_PREVIEW_LONG_EDGE.
 */

import { decodeTiffToCanvas, inspectTiffFile } from "@/lib/image/tiff-decode";

/** Longest edge of the retained thumbnail. Display size is smaller than this. */
const TIFF_PREVIEW_LONG_EDGE = 480;

export type TiffPreviewResult =
  | {
      kind: "image";
      url: string;
      width: number;
      height: number;
      extraPages: boolean;
      hasTransparency: boolean;
    }
  | { kind: "unavailable"; width: number | null; height: number | null };

function scaleCanvas(source: HTMLCanvasElement, maxEdge: number): HTMLCanvasElement {
  const longest = Math.max(source.width, source.height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("preview");
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("preview"));
    }, "image/png");
  });
}

function releaseCanvas(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

function canvasHasTransparency(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  const stripHeight = 64;
  for (let y = 0; y < canvas.height; y += stripHeight) {
    const height = Math.min(stripHeight, canvas.height - y);
    const data = context.getImageData(0, y, canvas.width, height).data;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] !== 255) return true;
    }
  }
  return false;
}

export async function createTiffPreview(file: File): Promise<TiffPreviewResult> {
  let width: number;
  let height: number;
  try {
    const inspection = await inspectTiffFile(file);
    width = inspection.width;
    height = inspection.height;
  } catch {
    return { kind: "unavailable", width: null, height: null };
  }

  let source: HTMLCanvasElement | null = null;
  let preview: HTMLCanvasElement | null = null;
  try {
    const decoded = await decodeTiffToCanvas(file);
    source = decoded.canvas;
    const hasTransparency = canvasHasTransparency(source);
    preview = scaleCanvas(source, TIFF_PREVIEW_LONG_EDGE);
    releaseCanvas(source);
    source = null;
    const blob = await canvasToPngBlob(preview);
    return {
      kind: "image",
      url: URL.createObjectURL(blob),
      width,
      height,
      extraPages: decoded.extraPages,
      hasTransparency,
    };
  } catch {
    return { kind: "unavailable", width, height };
  } finally {
    releaseCanvas(source);
    releaseCanvas(preview);
  }
}
