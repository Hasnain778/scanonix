import { NextResponse } from "next/server";
import { basename } from "node:path";
import {
  limitReachedResponse,
  resolveFreeToolAccess,
  validateUploadSize,
} from "@/lib/plan/access";
import { consumeUsage } from "@/lib/plan/usage";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  detectImageMimeType,
  FREE_IMAGE_MAX_BYTES,
  isSupportedImageMime,
} from "@/lib/tools/shared/image-validate";

export interface ImageToolFileInput {
  file: File;
  buffer: Buffer;
  mimeType: string;
}

export interface ImageToolContext {
  userId: string;
  route: string;
}

export interface ImageToolHandlerOptions {
  toolId: string;
  requirePremium?: boolean;
  maxBytes?: number;
  rateLimit?: { limit: number; windowMs: number };
}

const DEFAULT_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

function sanitizeFileName(name: string): string {
  const base = basename(name.replace(/\\/g, "/"));
  return base.replace(/[^\w.\-() ]+/g, "_").slice(0, 200) || "image";
}

export async function readImageFromFormData(
  formData: FormData,
  field = "file",
  maxBytes = FREE_IMAGE_MAX_BYTES,
): Promise<ImageToolFileInput | NextResponse> {
  const file = formData.get(field);
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "An image file is required." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
  }

  if (file.size > maxBytes) {
    return NextResponse.json(
      {
        error: `Image exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit.`,
      },
      { status: 400 },
    );
  }

  const mimeType = detectImageMimeType(file.name, file.type);
  if (!mimeType || !isSupportedImageMime(mimeType)) {
    return NextResponse.json(
      { error: "Unsupported image format. Use JPG, PNG, WEBP, or HEIC." },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  return {
    file,
    buffer: Buffer.from(arrayBuffer),
    mimeType,
  };
}

export async function handleImageToolRequest(
  request: Request,
  route: string,
  options: ImageToolHandlerOptions,
  handler: (
    ctx: ImageToolContext,
    formData: FormData,
    fileInput: ImageToolFileInput,
  ) => Promise<NextResponse>,
): Promise<NextResponse> {
  const rateLimit = options.rateLimit ?? DEFAULT_RATE_LIMIT;
  const rateLimited = enforceRateLimit(request, { route, ...rateLimit });
  if (rateLimited) return rateLimited;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart request." }, { status: 400 });
  }

  const fileField = formData.get("file");
  const fileSizeBytes = fileField instanceof File ? fileField.size : undefined;

  const access = await resolveFreeToolAccess(route, options.toolId, fileSizeBytes);
  if (access instanceof NextResponse) {
    return access;
  }

  const maxBytes = Math.min(
    options.maxBytes ?? FREE_IMAGE_MAX_BYTES,
    access.limits.maxUploadBytes,
  );

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

  const userId = access.anonymous ? "anonymous" : access.user.id;
  return handler({ userId, route }, formData, fileInput);
}

export function imageDownloadResponse(
  bytes: Buffer,
  fileName: string,
  contentType: string,
  stats?: {
    originalSize?: number;
    outputSize?: number;
    width?: number;
    height?: number;
    originalWidth?: number;
    originalHeight?: number;
  },
): NextResponse {
  const safeName = sanitizeFileName(fileName);
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${safeName}"`,
    "Cache-Control": "no-store",
  };

  if (stats?.originalSize !== undefined) {
    headers["X-Original-Size"] = String(stats.originalSize);
  }
  if (stats?.outputSize !== undefined) {
    headers["X-Output-Size"] = String(stats.outputSize);
  }
  if (stats?.width !== undefined) {
    headers["X-Output-Width"] = String(stats.width);
  }
  if (stats?.height !== undefined) {
    headers["X-Output-Height"] = String(stats.height);
  }
  if (stats?.originalWidth !== undefined) {
    headers["X-Original-Width"] = String(stats.originalWidth);
  }
  if (stats?.originalHeight !== undefined) {
    headers["X-Original-Height"] = String(stats.originalHeight);
  }

  return new NextResponse(new Uint8Array(bytes), { status: 200, headers });
}

export function pdfDownloadResponse(bytes: Uint8Array, fileName: string): NextResponse {
  const safeName = sanitizeFileName(fileName);
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
    },
  });
}
