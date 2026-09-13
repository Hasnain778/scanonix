import { NextResponse } from "next/server";
import {
  VectorizeError,
  VECTORIZE_MAX_BYTES,
  vectorizeImage,
} from "@/lib/design/vectorize";
import {
  handleImageToolRequest,
  imageDownloadResponse,
} from "@/lib/tools/shared/api-handler";
import { FREE_IMAGE_MAX_BYTES } from "@/lib/tools/shared/image-validate";

/**
 * Logo Vectorizer — public FREE_SERVER API.
 * Uses handleImageToolRequest for TOOL_ACCESS + usage metering.
 * Engine caps (5MB / 2048px / limitInputPixels) still apply inside vectorizeImage.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ROUTE = "/api/tools/logo-vectorizer";
const MAX_BYTES = Math.min(VECTORIZE_MAX_BYTES, FREE_IMAGE_MAX_BYTES);

function isHeicMime(mimeType: string): boolean {
  return mimeType === "image/heic" || mimeType === "image/heif";
}

function vectorizeErrorResponse(error: unknown): NextResponse {
  if (error instanceof VectorizeError) {
    const status =
      error.code === "TRACE_FAILED" || error.code === "INVALID_SVG_OUTPUT"
        ? 422
        : 400;
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status },
    );
  }

  return NextResponse.json(
    { error: "Could not vectorize image.", code: "VECTORIZE_FAILED" },
    { status: 500 },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleImageToolRequest(
    request,
    ROUTE,
    {
      toolId: "logo-vectorizer",
      maxBytes: MAX_BYTES,
      rateLimit: { limit: 20, windowMs: 60_000 },
    },
    async (_ctx, _formData, fileInput) => {
      if (isHeicMime(fileInput.mimeType)) {
        return NextResponse.json(
          {
            error: "Unsupported image format. Use PNG, JPG, or WebP.",
            code: "UNSUPPORTED_TYPE",
          },
          { status: 400 },
        );
      }

      const baseName =
        fileInput.file.name.replace(/\.[^.]+$/, "").replace(/[^\w.\-() ]+/g, "_").slice(0, 180) ||
        "logo";

      try {
        const result = await vectorizeImage(
          {
            buffer: fileInput.buffer,
            fileName: fileInput.file.name,
            mimeType: fileInput.mimeType,
          },
          { preset: "logo" },
        );

        return imageDownloadResponse(
          Buffer.from(result.svg, "utf8"),
          `${baseName}-vector.svg`,
          "image/svg+xml; charset=utf-8",
          {
            originalSize: fileInput.file.size,
            outputSize: result.byteSize,
            width: result.width,
            height: result.height,
            originalWidth: result.width,
            originalHeight: result.height,
          },
        );
      } catch (error) {
        return vectorizeErrorResponse(error);
      }
    },
  );
}
