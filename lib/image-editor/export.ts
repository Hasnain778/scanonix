/**
 * Offscreen export — IE-4A. Never uses the visible stage canvas.
 */

import { canvasToBlob } from "@/lib/image/normalize";
import { jpegFlattenColor } from "@/lib/image-editor/background";
import type { EditorDocument } from "@/lib/image-editor/document";
import { getCanvasOutputSize } from "@/lib/image-editor/geometry";
import {
  renderDocumentToCanvas,
  type RenderSource,
} from "@/lib/image-editor/render";
import { loadEditorFontFamily } from "@/lib/image-editor/fonts/loader";

export type EditorExportFormat = "png" | "jpeg" | "webp";

export interface EditorExportOptions {
  format: EditorExportFormat;
  quality?: number;
  jpegBackground?: string;
}

export interface EditorExportResult {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  mimeType: string;
}

export function deriveEditedFilename(
  originalFilename: string,
  format: EditorExportFormat,
): string {
  const base = originalFilename.replace(/\.[^/.]+$/, "") || "image";
  const safe = base.replace(/[^\w.\-()+ ]+/g, "_").trim() || "image";
  const ext = format === "png" ? "png" : format === "webp" ? "webp" : "jpg";
  return `${safe}-edited.${ext}`;
}

export function getExportDimensions(
  _sourceWidth: number,
  _sourceHeight: number,
  doc: Pick<EditorDocument, "canvas" | "crop" | "rotation">,
): { width: number; height: number } {
  return getCanvasOutputSize(doc.canvas);
}

export async function exportEditorDocument(
  source: RenderSource,
  doc: EditorDocument,
  originalFilename: string,
  options: EditorExportOptions,
): Promise<EditorExportResult> {
  // Await only faces used by text objects (family + weight).
  await Promise.all(
    doc.texts.map((t) => loadEditorFontFamily(t.fontFamilyId, [t.fontWeight])),
  );

  const rendered = renderDocumentToCanvas(source, doc);

  let exportCanvas = rendered;
  if (options.format === "jpeg") {
    const flat = document.createElement("canvas");
    flat.width = rendered.width;
    flat.height = rendered.height;
    const ctx = flat.getContext("2d");
    if (!ctx) {
      throw new Error("Could not prepare JPEG export.");
    }
    ctx.fillStyle =
      options.jpegBackground ?? jpegFlattenColor(doc.background);
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(rendered, 0, 0);
    exportCanvas = flat;
  }

  const mimeType =
    options.format === "png"
      ? "image/png"
      : options.format === "webp"
        ? "image/webp"
        : "image/jpeg";

  const quality =
    options.format === "png"
      ? undefined
      : Math.min(1, Math.max(0.1, options.quality ?? 0.92));

  const blob = await canvasToBlob(exportCanvas, mimeType, quality);

  return {
    blob,
    filename: deriveEditedFilename(originalFilename, options.format),
    width: exportCanvas.width,
    height: exportCanvas.height,
    mimeType,
  };
}
