import { NextResponse } from "next/server";
import { basename } from "node:path";
import { getPlanLimits } from "@/lib/plan/config";
import {
  VectorizeError,
  VECTORIZE_MAX_BYTES,
  vectorizeImage,
} from "@/lib/design/vectorize";
import { imageDownloadResponse } from "@/lib/tools/shared/api-handler";
import { enforceRateLimit } from "@/lib/security/rate-limit";

/**
 * Logo Vectorizer — server API foundation (no public UI yet).
 *
 * Intentionally does NOT use handleImageToolRequest / TOOL_ACCESS yet:
 * resolveFreeToolAccess requires a TOOL_ACCESS entry, and product registries
 * (nav, SEO, categories) stay untouched until the UI phase.
 *
 * Access model for this foundation: anonymous-friendly free limits
 * (rate limit + 5MB / engine caps). Usage metering lands with public exposure.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ROUTE = "/api/tools/logo-vectorizer";

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
  const rateLimited = enforceRateLimit(request, {
    route: ROUTE,
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart request.", code: "INVALID_MULTIPART" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "An image file is required.", code: "MISSING_FILE" },
      { status: 400 },
    );
  }

  if (file.size <= 0) {
    return NextResponse.json(
      { error: "The uploaded file is empty.", code: "EMPTY_FILE" },
      { status: 400 },
    );
  }

  const freeUploadCap = getPlanLimits("free").maxUploadBytes;
  const maxBytes = Math.min(VECTORIZE_MAX_BYTES, freeUploadCap);
  if (file.size > maxBytes) {
    return NextResponse.json(
      {
        error: `Image exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit.`,
        code: "TOO_LARGE",
      },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const baseName =
    basename(file.name.replace(/\\/g, "/")).replace(/\.[^.]+$/, "") || "logo";

  try {
    const result = await vectorizeImage(
      {
        buffer,
        fileName: file.name,
        mimeType: file.type || undefined,
      },
      { preset: "logo" },
    );

    return imageDownloadResponse(
      Buffer.from(result.svg, "utf8"),
      `${baseName}-vector.svg`,
      "image/svg+xml; charset=utf-8",
      {
        originalSize: file.size,
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
}
