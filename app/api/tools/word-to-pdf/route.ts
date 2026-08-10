import { NextResponse } from "next/server";
import { isCloudConvertConfigured } from "@/config/env";
import { cloudConvertProvider } from "@/lib/providers/conversion/cloudconvert-provider";
import { DocumentConversionNotConfiguredError } from "@/lib/providers/conversion/types";
import {
  limitReachedResponse,
  resolveFreeToolAccess,
  validateUploadSize,
} from "@/lib/plan/access";
import { consumeUsage } from "@/lib/plan/usage";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { pdfDownloadResponse } from "@/lib/tools/shared/api-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const WORD_TO_PDF_MAX_BYTES = 50 * 1024 * 1024;

function isDocxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function isLegacyDocFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".doc") ||
    file.type === "application/msword" ||
    file.type === "application/vnd.ms-word"
  );
}

export async function POST(request: Request) {
  const route = "/api/tools/word-to-pdf";

  const rateLimited = enforceRateLimit(request, { route, limit: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  if (!isCloudConvertConfigured()) {
    return NextResponse.json(
      { error: "Conversion service not configured." },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart request." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A Word document is required." }, { status: 400 });
  }

  const access = await resolveFreeToolAccess(route, "word-to-pdf", file.size);
  if (access instanceof NextResponse) {
    return access;
  }

  if (isLegacyDocFile(file)) {
    return NextResponse.json(
      {
        error:
          "Legacy .doc files are not supported. Please save your document as .docx in Word and try again.",
      },
      { status: 400 },
    );
  }

  if (!isDocxFile(file)) {
    return NextResponse.json(
      { error: "Only .docx Word documents are supported." },
      { status: 400 },
    );
  }

  const maxBytes = Math.min(WORD_TO_PDF_MAX_BYTES, access.limits.maxUploadBytes);
  if (file.size <= 0) {
    return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
  }
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `File exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit.` },
      { status: 400 },
    );
  }

  const uploadError = validateUploadSize(route, file.size, access.limits);
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

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfBytes = await cloudConvertProvider.convertDocxToPdf(buffer, file.name);
    const baseName = file.name.replace(/\.docx$/i, "") || "document";
    return pdfDownloadResponse(new Uint8Array(pdfBytes), `${baseName}.pdf`);
  } catch (error) {
    if (error instanceof DocumentConversionNotConfiguredError) {
      return NextResponse.json(
        { error: "Conversion service not configured." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not convert document to PDF.",
      },
      { status: 422 },
    );
  }
}
