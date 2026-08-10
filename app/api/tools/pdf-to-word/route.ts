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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const PDF_TO_WORD_MAX_BYTES = 50 * 1024 * 1024;

function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || file.type === "application/pdf";
}

function docxDownloadResponse(bytes: Buffer, fileName: string): NextResponse {
  const safeName = fileName.replace(/[^\w.\-() ]+/g, "_").slice(0, 200) || "document.docx";
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const route = "/api/tools/pdf-to-word";

  const rateLimited = enforceRateLimit(request, { route, limit: 10, windowMs: 60_000 });
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
    return NextResponse.json({ error: "A PDF file is required." }, { status: 400 });
  }

  const access = await resolveFreeToolAccess(route, "pdf-to-word", file.size);
  if (access instanceof NextResponse) {
    return access;
  }

  if (!isPdfFile(file)) {
    return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
  }

  const maxBytes = Math.min(PDF_TO_WORD_MAX_BYTES, access.limits.maxUploadBytes);
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

  if (access.anonymous) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
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

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const docxBuffer = await cloudConvertProvider.convertPdfToDocx(buffer, file.name);
    const baseName = file.name.replace(/\.pdf$/i, "") || "document";
    return docxDownloadResponse(docxBuffer, `${baseName}.docx`);
  } catch (error) {
    if (error instanceof DocumentConversionNotConfiguredError) {
      return NextResponse.json(
        { error: "Conversion service not configured." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not convert PDF to Word.",
      },
      { status: 422 },
    );
  }
}
