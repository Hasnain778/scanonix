/**
 * Browser-only rasterization for secure redaction export (Phase 125B/125C).
 */

import { configurePdfWorker } from "@/lib/pdf/configure-worker";
import { normalizedRedactionsToCanvasRects } from "./coordinates";
import { REDACT_RASTER_MIME } from "./limits";
import { computeRedactPageRenderPlan } from "./render-plan";
import type { NormalizedRedactionRect } from "./types";
import { RedactPdfError } from "./types";

export interface RasterizeRedactedPageOptions {
  pdfBytes: ArrayBuffer;
  pageIndex: number;
  rotation: number;
  redactions: NormalizedRedactionRect[];
}

export interface RasterizedPageResult {
  imageBytes: Uint8Array;
  mimeType: typeof REDACT_RASTER_MIME;
  pageWidthPt: number;
  pageHeightPt: number;
  canvasWidth: number;
  canvasHeight: number;
}

async function loadPdfJsDocument(pdfBytes: ArrayBuffer) {
  const data = new Uint8Array(pdfBytes.slice(0));
  await configurePdfWorker();
  const pdfjs = await import("pdfjs-dist");
  return pdfjs.getDocument({ data }).promise;
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Failed to encode raster page."));
    }, REDACT_RASTER_MIME);
  });
  return new Uint8Array(await blob.arrayBuffer());
}

function burnRedactionRects(
  context: CanvasRenderingContext2D,
  redactions: NormalizedRedactionRect[],
  canvasWidth: number,
  canvasHeight: number,
): void {
  context.fillStyle = "#000000";
  for (const rect of normalizedRedactionsToCanvasRects(
    redactions,
    canvasWidth,
    canvasHeight,
  )) {
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
}

export async function rasterizeRedactedPage(
  options: RasterizeRedactedPageOptions,
): Promise<RasterizedPageResult> {
  const { pdfBytes, pageIndex, rotation, redactions } = options;

  if (redactions.length === 0) {
    throw new RedactPdfError(
      "RASTERIZATION_FAILED",
      "Cannot rasterize a redacted page without redaction regions.",
    );
  }

  let pdf: Awaited<ReturnType<typeof loadPdfJsDocument>>;

  try {
    pdf = await loadPdfJsDocument(pdfBytes);
  } catch (error) {
    throw new RedactPdfError(
      "RASTERIZATION_FAILED",
      error instanceof Error ? error.message : "Could not load PDF for rasterization.",
    );
  }

  if (pageIndex < 0 || pageIndex >= pdf.numPages) {
    throw new RedactPdfError(
      "INVALID_PAGE",
      `Page ${pageIndex + 1} is outside the document range.`,
    );
  }

  const page = await pdf.getPage(pageIndex + 1);
  const baseViewport = page.getViewport({ scale: 1, rotation });
  const plan = computeRedactPageRenderPlan({
    viewportWidth: baseViewport.width,
    viewportHeight: baseViewport.height,
  });

  if (plan.canvasWidth <= 0 || plan.canvasHeight <= 0) {
    throw new RedactPdfError(
      "MEMORY_LIMIT",
      "Page dimensions exceed supported raster limits.",
    );
  }

  const viewport = page.getViewport({ scale: plan.scale, rotation });
  const canvas = document.createElement("canvas");
  canvas.width = plan.canvasWidth;
  canvas.height = plan.canvasHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new RedactPdfError(
      "RASTERIZATION_FAILED",
      "Could not create canvas context for redaction rasterization.",
    );
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, plan.canvasWidth, plan.canvasHeight);

  try {
    await page.render({
      canvasContext: context,
      viewport,
      canvas,
    }).promise;
  } catch (error) {
    throw new RedactPdfError(
      "RASTERIZATION_FAILED",
      error instanceof Error ? error.message : "PDF page render failed.",
    );
  }

  burnRedactionRects(context, redactions, plan.canvasWidth, plan.canvasHeight);

  let imageBytes: Uint8Array;

  try {
    imageBytes = await canvasToPngBytes(canvas);
  } catch (error) {
    throw new RedactPdfError(
      "RASTERIZATION_FAILED",
      error instanceof Error ? error.message : "Failed to encode redacted page.",
    );
  }

  return {
    imageBytes,
    mimeType: REDACT_RASTER_MIME,
    pageWidthPt: plan.pageWidthPt,
    pageHeightPt: plan.pageHeightPt,
    canvasWidth: plan.canvasWidth,
    canvasHeight: plan.canvasHeight,
  };
}

/** Test hook: simulate raster failure without exporting partial output. */
export function createRasterFailureGuard(shouldFail: boolean): () => void {
  return () => {
    if (shouldFail) {
      throw new RedactPdfError(
        "RASTERIZATION_FAILED",
        "Simulated rasterization failure.",
      );
    }
  };
}
