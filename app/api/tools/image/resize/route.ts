import { NextResponse } from "next/server";
import { assertBufferMatchesFormat } from "@/lib/image/validate-binary";
import { resizeImage } from "@/lib/tools/image/resize-image";
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
  const route = "/api/tools/image/resize";

  return handleImageToolRequest(
    request,
    route,
    { toolId: "image-resizer", maxBytes: FREE_IMAGE_MAX_BYTES },
    async (_ctx, formData, fileInput) => {
      const widthRaw = formData.get("width");
      const heightRaw = formData.get("height");
      const width = widthRaw ? Number(widthRaw) : undefined;
      const height = heightRaw ? Number(heightRaw) : undefined;
      const fitRaw = String(formData.get("fit") ?? "inside");
      const fit =
        fitRaw === "cover" ||
        fitRaw === "contain" ||
        fitRaw === "fill" ||
        fitRaw === "inside" ||
        fitRaw === "outside"
          ? fitRaw
          : "inside";
      const formatRaw = String(formData.get("format") ?? "").toLowerCase();
      const format =
        formatRaw === "png" || formatRaw === "webp" || formatRaw === "jpeg"
          ? (formatRaw as "jpeg" | "png" | "webp")
          : undefined;

      try {
        const result = await resizeImage(fileInput.buffer, { width, height, fit, format });
        assertBufferMatchesFormat(
          result.buffer,
          result.format === "png" ? "png" : result.format === "webp" ? "webp" : "jpg",
        );
        const ext = outputExtension(result.format);
        const baseName = fileInput.file.name.replace(/\.[^.]+$/, "") || "image";

        return imageDownloadResponse(
          result.buffer,
          `${baseName}-resized.${ext}`,
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
            error: error instanceof Error ? error.message : "Could not resize image.",
          },
          { status: 422 },
        );
      }
    },
  );
}
