import { NextResponse } from "next/server";
import { basename } from "node:path";
import sharp, { type Metadata, type OutputInfo } from "sharp";
import {
  PSD_MAX_OUTPUT_BYTES,
  PSD_MAX_PIXELS,
  PSD_MAX_SIDE,
  PsdError,
  createPsdFromRaster,
  sanitizePsdLayerName,
  validatePsdBuffer,
} from "@/lib/design/psd";
import {
  handleImageToolRequest,
  imageDownloadResponse,
} from "@/lib/tools/shared/api-handler";
import { FREE_IMAGE_MAX_BYTES } from "@/lib/tools/shared/image-validate";

/**
 * PNG to PSD — FREE_SERVER API for /tools/png-to-psd.
 *
 * PNG → Sharp (rotate / sRGB / RGBA8) → alpha scan → shared createPsdFromRaster.
 * No client options. No canvas. Shared PSD engine unchanged.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ROUTE = "/api/tools/png-to-psd";
const MAX_BYTES = FREE_IMAGE_MAX_BYTES; // 10 MB
const ALLOWED_FORM_FIELDS = new Set(["file"]);

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function isPngMagic(buffer: Buffer): boolean {
  return (
    buffer.length >= PNG_SIGNATURE.length &&
    buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  );
}

function isPngMime(mimeType: string): boolean {
  const mime = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  return mime === "image/png";
}

/** True when PNG contains an APNG acTL chunk (animation control). */
function hasApngActlChunk(buffer: Buffer): boolean {
  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "acTL") return true;
    if (type === "IEND") return false;
    // length + type(4) + data + crc(4)
    const next = offset + 12 + length;
    if (next <= offset || next > buffer.length) return false;
    offset = next;
  }
  return false;
}

function isAnimatedPng(buffer: Buffer, meta: Metadata): boolean {
  if (hasApngActlChunk(buffer)) return true;
  if ((meta.pages ?? 1) > 1) return true;
  if (Array.isArray(meta.delay) && meta.delay.length > 1) return true;
  return false;
}

function rgbaHasTransparency(data: Buffer): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 255) return true;
  }
  return false;
}

function layerNameFromFileName(fileName: string): string {
  const base = basename(fileName.replace(/\\/g, "/")).replace(/\.[^.]+$/, "");
  return sanitizePsdLayerName(base);
}

function orientedDimensions(
  width: number,
  height: number,
  orientation: number | undefined,
): { width: number; height: number } {
  const o = orientation ?? 1;
  if (o >= 5 && o <= 8) {
    return { width: height, height: width };
  }
  return { width, height };
}

function jsonError(
  error: string,
  code: string,
  status: number,
): NextResponse {
  return NextResponse.json({ error, code }, { status });
}

function mapPsdError(error: PsdError): NextResponse {
  switch (error.code) {
    case "DIMENSIONS_TOO_LARGE":
    case "PIXEL_LIMIT_EXCEEDED":
      return jsonError(error.message, "DIMENSIONS_TOO_LARGE", 400);
    case "OUTPUT_TOO_LARGE":
      return jsonError(error.message, "OUTPUT_TOO_LARGE", 400);
    case "INVALID_DIMENSIONS":
    case "INVALID_PIXEL_DATA":
      return jsonError(error.message, "INVALID_IMAGE", 400);
    case "ENCODE_FAILED":
    case "INVALID_PSD":
    case "UNEXPECTED_STRUCTURE":
      return jsonError(error.message, "PSD_ENCODE_FAILED", 422);
    default:
      return jsonError(error.message, "PSD_ENCODE_FAILED", 422);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleImageToolRequest(
    request,
    ROUTE,
    {
      toolId: "png-to-psd",
      maxBytes: MAX_BYTES,
      rateLimit: { limit: 10, windowMs: 60_000 },
    },
    async (_ctx, formData, fileInput) => {
      for (const key of formData.keys()) {
        if (!ALLOWED_FORM_FIELDS.has(key)) {
          return jsonError(
            `Unsupported field: ${key}`,
            "UNSUPPORTED_FIELD",
            400,
          );
        }
      }

      if (!isPngMagic(fileInput.buffer)) {
        return jsonError(
          "Unsupported image format. Use a PNG file.",
          "UNSUPPORTED_TYPE",
          400,
        );
      }

      // Secondary MIME check — magic already required.
      if (
        fileInput.mimeType &&
        !isPngMime(fileInput.mimeType) &&
        fileInput.mimeType !== "application/octet-stream"
      ) {
        if (
          fileInput.mimeType.startsWith("image/") &&
          !isPngMime(fileInput.mimeType)
        ) {
          return jsonError(
            "Unsupported image format. Use a PNG file.",
            "UNSUPPORTED_TYPE",
            400,
          );
        }
      }

      let meta: Metadata;
      try {
        meta = await sharp(fileInput.buffer, {
          failOn: "none",
          limitInputPixels: PSD_MAX_PIXELS,
        }).metadata();
      } catch {
        return jsonError(
          "Could not read this PNG image.",
          "INVALID_IMAGE",
          400,
        );
      }

      if (isAnimatedPng(fileInput.buffer, meta)) {
        return jsonError(
          "Animated PNG (APNG) is not supported. Upload a single-frame PNG.",
          "UNSUPPORTED_TYPE",
          400,
        );
      }

      const rawW = meta.width ?? 0;
      const rawH = meta.height ?? 0;
      if (!rawW || !rawH) {
        return jsonError(
          "Could not determine PNG dimensions.",
          "INVALID_IMAGE",
          400,
        );
      }

      const dims = orientedDimensions(rawW, rawH, meta.orientation);
      if (dims.width > PSD_MAX_SIDE || dims.height > PSD_MAX_SIDE) {
        return jsonError(
          `Image exceeds the ${PSD_MAX_SIDE}px side limit.`,
          "DIMENSIONS_TOO_LARGE",
          400,
        );
      }
      if (dims.width * dims.height > PSD_MAX_PIXELS) {
        return jsonError(
          `Image exceeds the ${PSD_MAX_PIXELS} pixel limit.`,
          "DIMENSIONS_TOO_LARGE",
          400,
        );
      }

      let decoded: { data: Buffer; info: OutputInfo };
      try {
        decoded = await sharp(fileInput.buffer, {
          failOn: "none",
          limitInputPixels: PSD_MAX_PIXELS,
        })
          .rotate()
          .toColorspace("srgb")
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
      } catch (error) {
        return jsonError(
          error instanceof Error
            ? error.message
            : "Could not convert this PNG for PSD creation.",
          "INVALID_IMAGE",
          400,
        );
      }

      if (decoded.info.channels !== 4) {
        return jsonError(
          "PNG decode did not produce RGBA pixels.",
          "INVALID_IMAGE",
          400,
        );
      }

      if (
        decoded.info.width > PSD_MAX_SIDE ||
        decoded.info.height > PSD_MAX_SIDE ||
        decoded.info.width * decoded.info.height > PSD_MAX_PIXELS
      ) {
        return jsonError(
          `Image exceeds the ${PSD_MAX_SIDE}px / ${PSD_MAX_PIXELS} pixel limits.`,
          "DIMENSIONS_TOO_LARGE",
          400,
        );
      }

      const hasAlpha = rgbaHasTransparency(decoded.data);
      const layerName = layerNameFromFileName(fileInput.file.name);
      const downloadBase =
        basename(fileInput.file.name.replace(/\\/g, "/"))
          .replace(/\.[^.]+$/, "")
          .replace(/[^\w.\-() ]+/g, "_")
          .trim()
          .slice(0, 180) || "image";

      let psd: Buffer;
      try {
        psd = createPsdFromRaster({
          width: decoded.info.width,
          height: decoded.info.height,
          data: decoded.data,
          channels: 4,
          layerName,
          hasAlpha,
        });
        validatePsdBuffer(psd, {
          width: decoded.info.width,
          height: decoded.info.height,
          layerName,
        });
      } catch (error) {
        if (error instanceof PsdError) {
          if (error.code === "OUTPUT_TOO_LARGE") {
            return jsonError(
              `Generated PSD exceeds the ${Math.round(PSD_MAX_OUTPUT_BYTES / (1024 * 1024))}MB output limit.`,
              "OUTPUT_TOO_LARGE",
              400,
            );
          }
          return mapPsdError(error);
        }
        return jsonError(
          error instanceof Error ? error.message : "Could not create PSD.",
          "PSD_ENCODE_FAILED",
          422,
        );
      }

      const response = imageDownloadResponse(
        psd,
        `${downloadBase}.psd`,
        "image/vnd.adobe.photoshop",
        {
          originalSize: fileInput.file.size,
          outputSize: psd.byteLength,
          width: decoded.info.width,
          height: decoded.info.height,
          originalWidth: decoded.info.width,
          originalHeight: decoded.info.height,
        },
      );
      // Same alpha-scan result used for hasAlpha — no shared-helper refactor.
      response.headers.set("X-Image-Has-Alpha", hasAlpha ? "true" : "false");
      return response;
    },
  );
}
