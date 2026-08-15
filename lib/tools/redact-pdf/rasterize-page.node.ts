/**
 * Node.js rasterization for secure redaction tests (Phase 125B).
 */

import { normalizedRedactionsToCanvasRects } from "./coordinates";
import { REDACT_RASTER_MIME } from "./limits";
import { loadPdfJsDocumentNode } from "./pdfjs-node";
import { computeRedactPageRenderPlan } from "./render-plan";
import type {
  RasterizeRedactedPageOptions,
  RasterizedPageResult,
} from "./rasterize-page.browser";
import type { NormalizedRedactionRect } from "./types";
import { RedactPdfError } from "./types";

async function createNodeCanvas(width: number, height: number): Promise<HTMLCanvasElement> {
  const { createCanvas } = await import("@napi-rs/canvas");
  return createCanvas(width, height) as unknown as HTMLCanvasElement;
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

  let pdf: Awaited<ReturnType<typeof loadPdfJsDocumentNode>>;

  try {
    pdf = await loadPdfJsDocumentNode(new Uint8Array(pdfBytes.slice(0)));
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
  const canvas = await createNodeCanvas(plan.canvasWidth, plan.canvasHeight);
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

  const nodeCanvas = canvas as HTMLCanvasElement & {
    toBuffer?: (mime: string) => Buffer;
  };

  if (typeof nodeCanvas.toBuffer !== "function") {
    throw new RedactPdfError(
      "RASTERIZATION_FAILED",
      "Could not encode redacted page raster.",
    );
  }

  const imageBytes = new Uint8Array(nodeCanvas.toBuffer("image/png"));

  return {
    imageBytes,
    mimeType: REDACT_RASTER_MIME,
    pageWidthPt: plan.pageWidthPt,
    pageHeightPt: plan.pageHeightPt,
    canvasWidth: plan.canvasWidth,
    canvasHeight: plan.canvasHeight,
  };
}
