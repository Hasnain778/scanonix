import { NextResponse } from "next/server";
import { isRembgConfigured } from "@/config/env";
import {
  BackgroundRemoverProcessingError,
  FREE_MAX_LONG_EDGE,
  PRO_MAX_LONG_EDGE,
  RembgNotConfiguredError,
  rembgServerProvider,
} from "@/lib/providers/background-removal/rembg-server-provider";
import { nativeProviderUnavailableMessage } from "@/lib/providers/runtime/production-guards";
import {
  limitReachedResponse,
  resolveFreeToolAccess,
  validateUploadSize,
} from "@/lib/plan/access";
import { consumeUsage } from "@/lib/plan/usage";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  imageDownloadResponse,
  readImageFromFormData,
} from "@/lib/tools/shared/api-handler";
import { MAX_BACKGROUND_REMOVER_BYTES } from "@/lib/tools/background-remover/file-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const route = "/api/tools/background-remover/remove";

  const rateLimited = enforceRateLimit(request, { route, limit: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  if (!isRembgConfigured()) {
    return NextResponse.json(
      { error: nativeProviderUnavailableMessage("Background removal"), code: "NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart request." }, { status: 400 });
  }

  const fileField = formData.get("file");
  const fileSizeBytes = fileField instanceof File ? fileField.size : undefined;

  const access = await resolveFreeToolAccess(route, "background-remover", fileSizeBytes);
  if (access instanceof NextResponse) {
    return access;
  }

  const maxBytes = Math.min(MAX_BACKGROUND_REMOVER_BYTES, access.limits.maxUploadBytes);
  const fileInput = await readImageFromFormData(formData, "file", maxBytes);
  if (fileInput instanceof NextResponse) {
    return fileInput;
  }

  const uploadError = validateUploadSize(route, fileInput.file.size, access.limits);
  if (uploadError) {
    return uploadError;
  }

  if (!access.anonymous) {
    try {
      const usage = await consumeUsage(access.user.id, access.plan);
      if (!usage.allowed) {
        return limitReachedResponse(route, "Tool operation limit reached for your current plan.", {
          usageCount: usage.usageCount,
          limit: usage.limit,
          remaining: usage.remaining,
          resetAt: usage.resetAt,
        });
      }
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Could not authorize operation.",
        },
        { status: 500 },
      );
    }
  }

  const fullResolution = !access.anonymous && access.limits.allow4KExport;
  const processingMaxLongEdge = fullResolution
    ? PRO_MAX_LONG_EDGE
    : FREE_MAX_LONG_EDGE;

  try {
    const result = await rembgServerProvider.removeBackground(
      fileInput.buffer,
      fileInput.mimeType,
      { processingMaxLongEdge },
    );

    if (result.likelyNoSubject) {
      return NextResponse.json(
        {
          error:
            "Could not detect a clear subject in this image. Try a photo with a distinct foreground object or person.",
          code: "no_subject",
        },
        { status: 422 },
      );
    }

    const baseName = fileInput.file.name.replace(/\.[^.]+$/, "") || "image";

    const response = imageDownloadResponse(
      result.buffer,
      `${baseName}-no-bg.png`,
      "image/png",
      {
        originalSize: fileInput.file.size,
        outputSize: result.buffer.length,
        width: result.width,
        height: result.height,
        originalWidth: result.originalWidth,
        originalHeight: result.originalHeight,
      },
    );

    response.headers.set("X-Processing-Optimized", result.wasOptimized ? "true" : "false");
    return response;
  } catch (error) {
    if (error instanceof BackgroundRemoverProcessingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof RembgNotConfiguredError) {
      return NextResponse.json(
        { error: error.message, code: "NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Background removal failed.",
      },
      { status: 422 },
    );
  }
}
