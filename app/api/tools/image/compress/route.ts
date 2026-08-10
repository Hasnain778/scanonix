import { NextResponse } from "next/server";
import { assertBufferMatchesFormat } from "@/lib/image/validate-binary";
import { compressImage } from "@/lib/tools/image/compress-image";
import {
  handleImageToolRequest,
  imageDownloadResponse,
} from "@/lib/tools/shared/api-handler";
import { FREE_IMAGE_MAX_BYTES } from "@/lib/tools/shared/image-validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function outputExtension(format: string): string {
  if (format === "png") return "png";
  if (format === "webp") return "webp";
  return "jpg";
}

function outputMime(format: string): string {
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return "image/jpeg";
}

export async function POST(request: Request) {
  const route = "/api/tools/image/compress";

  return handleImageToolRequest(
    request,
    route,
    { toolId: "image-compressor", maxBytes: FREE_IMAGE_MAX_BYTES },
    async (_ctx, formData, fileInput) => {
      const quality = Number(formData.get("quality") ?? 80);

      try {
        const result = await compressImage(fileInput.buffer, {
          quality: Number.isFinite(quality) ? quality : 80,
        });
        assertBufferMatchesFormat(
          result.buffer,
          result.format === "png" ? "png" : result.format === "webp" ? "webp" : "jpg",
        );
        const ext = outputExtension(result.format);
        const baseName = fileInput.file.name.replace(/\.[^.]+$/, "") || "image";

        return imageDownloadResponse(
          result.buffer,
          `${baseName}-compressed.${ext}`,
          outputMime(result.format),
          {
            originalSize: fileInput.file.size,
            outputSize: result.buffer.length,
            width: result.width,
            height: result.height,
          },
        );
      } catch (error) {
        return NextResponse.json(
          {
            error: error instanceof Error ? error.message : "Could not compress image.",
          },
          { status: 422 },
        );
      }
    },
  );
}
