import { NextResponse } from "next/server";
import { basename } from "node:path";
import {
  limitReachedResponse,
  requireProUser,
  validateUploadSize,
} from "@/lib/plan/access";
import { consumeUsage } from "@/lib/plan/usage";
import type { SecurityToolId } from "@/lib/security-tools/constants";
import { SECURITY_TOOL_RATE_LIMIT } from "@/lib/security-tools/constants";
import { recordSecurityToolUsage } from "@/lib/security-tools/usage";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export interface SecurityToolFileInput {
  file: File;
  buffer: Buffer;
}

export interface SecurityToolContext {
  userId: string;
  toolId: SecurityToolId;
  route: string;
}

function sanitizeFileName(name: string): string {
  const base = basename(name.replace(/\\/g, "/"));
  return base.replace(/[^\w.\-() ]+/g, "_").slice(0, 200) || "file";
}

export function parsePdfFromFormData(formData: FormData): SecurityToolFileInput | NextResponse {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A PDF file is required." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
  }

  return { file, buffer: Buffer.from([]) };
}

export async function readFileFromFormData(
  formData: FormData,
  field = "file",
): Promise<SecurityToolFileInput | NextResponse> {
  const file = formData.get(field);
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file upload is required." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  return {
    file,
    buffer: Buffer.from(arrayBuffer),
  };
}

export async function handleSecurityToolRequest(
  request: Request,
  route: string,
  toolId: SecurityToolId,
  handler: (
    ctx: SecurityToolContext,
    formData: FormData,
    fileInput: SecurityToolFileInput,
  ) => Promise<NextResponse>,
): Promise<NextResponse> {
  const rateLimited = enforceRateLimit(request, {
    route,
    limit: SECURITY_TOOL_RATE_LIMIT.limit,
    windowMs: SECURITY_TOOL_RATE_LIMIT.windowMs,
  });
  if (rateLimited) return rateLimited;

  const access = await requireProUser(route);
  if (access instanceof NextResponse) {
    return access;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart request." }, { status: 400 });
  }

  const fileInput = await readFileFromFormData(formData);
  if (fileInput instanceof NextResponse) {
    return fileInput;
  }

  const uploadError = validateUploadSize(route, fileInput.file.size, access.limits);
  if (uploadError) {
    return uploadError;
  }

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

  const response = await handler(
    { userId: access.user.id, toolId, route },
    formData,
    fileInput,
  );

  if (response.ok) {
    await recordSecurityToolUsage({
      userId: access.user.id,
      toolId,
      fileSizeBytes: fileInput.file.size,
      metadata: { fileName: sanitizeFileName(fileInput.file.name) },
    });
  }

  return response;
}

export function pdfDownloadResponse(
  bytes: Uint8Array,
  fileName: string,
  extraHeaders?: Record<string, string>,
): NextResponse {
  const safeName = sanitizeFileName(fileName);
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
      ...(extraHeaders ?? {}),
    },
  });
}

export function binaryDownloadResponse(
  bytes: Uint8Array,
  fileName: string,
  contentType: string,
): NextResponse {
  const safeName = sanitizeFileName(fileName);
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
    },
  });
}
