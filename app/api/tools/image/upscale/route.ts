import { NextResponse } from "next/server";
import { env, isRealEsrganConfigured } from "@/config/env";
import {
  RealEsrganNotConfiguredError,
  realEsrganProvider,
} from "@/lib/providers/upscale/realesrgan-provider";
import { nativeProviderUnavailableMessage } from "@/lib/providers/runtime/production-guards";
import type { UpscaleFactor } from "@/lib/providers/upscale/types";
import {
  handleImageToolRequest,
  imageDownloadResponse,
} from "@/lib/tools/shared/api-handler";
import { FREE_IMAGE_MAX_BYTES } from "@/lib/tools/shared/image-validate";
import sharp from "sharp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function outputExtension(format: string): string {
  if (format === "png") return "png";
  return "jpg";
}

function outputMime(format: string): string {
  if (format === "png") return "image/png";
  return "image/jpeg";
}

export async function POST(request: Request) {
  const route = "/api/tools/image/upscale";

  if (env.realesrganServiceUrl.trim()) {
    return NextResponse.json(
      {
        error:
          "Synchronous upscaling is disabled in production. Create an async job instead.",
        code: "ASYNC_REQUIRED",
        jobsUrl: "/api/tools/image/upscale/jobs",
      },
      { status: 409 },
    );
  }

  if (!isRealEsrganConfigured()) {
    return NextResponse.json(
      { error: nativeProviderUnavailableMessage("Image upscaling"), code: "NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  return handleImageToolRequest(
    request,
    route,
    {
      toolId: "image-upscaler",
      requirePremium: true,
      maxBytes: FREE_IMAGE_MAX_BYTES,
      rateLimit: { limit: 15, windowMs: 60_000 },
    },
    async (_ctx, formData, fileInput) => {
      const factorRaw = Number(formData.get("factor") ?? 2);
      const factor: UpscaleFactor = factorRaw === 4 ? 4 : 2;

      try {
        const inputMeta = await sharp(fileInput.buffer, { failOn: "none" }).metadata();
        const originalWidth = inputMeta.width ?? 0;
        const originalHeight = inputMeta.height ?? 0;

        const result = await realEsrganProvider.upscale(fileInput.buffer, {
          factor,
          preserveAlpha: inputMeta.hasAlpha === true,
        });

        const ext = outputExtension(result.format);
        const baseName = fileInput.file.name.replace(/\.[^.]+$/, "") || "image";

        return imageDownloadResponse(
          result.buffer,
          `${baseName}-${factor}x.${ext}`,
          outputMime(result.format),
          {
            originalSize: fileInput.file.size,
            outputSize: result.buffer.length,
            width: result.width,
            height: result.height,
            originalWidth,
            originalHeight,
          },
        );
      } catch (error) {
        if (error instanceof RealEsrganNotConfiguredError) {
          return NextResponse.json(
            { error: error.message, code: "NOT_CONFIGURED" },
            { status: 503 },
          );
        }

        return NextResponse.json(
          {
            error: error instanceof Error ? error.message : "Could not upscale image.",
          },
          { status: 422 },
        );
      }
    },
  );
}
