import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { isGhostscriptConfigured } from "@/config/env";
import { resolveFreeToolAccess } from "@/lib/plan/access";
import { assertPdfBytes } from "@/lib/image/validate-binary";
import {
  compressPdfWithProvider,
  getPdfCompressionProvider,
} from "@/lib/providers/pdf/compression/ghostscript-provider";
import {
  mapLegacyCompressionLevel,
  PdfCompressionFailedError,
  PdfCompressionNotConfiguredError,
} from "@/lib/providers/pdf/compression/types";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { compressPdfBytes } from "@/lib/tools/compress-pdf/compress-pdf";
import {
  type CompressionLevel,
  PdfCompressionError,
} from "@/lib/tools/compress-pdf/compression-levels";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const ROUTE = "/api/tools/pdf/compress";
const PRO_ONLY_LEVELS = new Set<CompressionLevel>(["recommended", "strong"]);

function isCompressionLevel(value: string): value is CompressionLevel {
  return value === "light" || value === "recommended" || value === "strong";
}

export async function POST(request: Request) {
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
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Upload a PDF file." }, { status: 400 });
  }

  const access = await resolveFreeToolAccess(ROUTE, "compress-pdf", file.size);
  if (access instanceof NextResponse) {
    return access;
  }

  const isPro = access.limits.plan !== "free";
  const levelRaw = String(formData.get("level") ?? "light");
  const level: CompressionLevel = isCompressionLevel(levelRaw) ? levelRaw : "light";

  if (!isPro && PRO_ONLY_LEVELS.has(level)) {
    return NextResponse.json(
      {
        error:
          "Medium and strong compression require Pro. Free users can use light compression.",
        code: "PRO_REQUIRED",
      },
      { status: 403 },
    );
  }

  let input: Buffer;
  try {
    input = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Could not read uploaded file." }, { status: 400 });
  }

  try {
    assertPdfBytes(input);
  } catch {
    return NextResponse.json(
      { error: "Uploaded file is not a valid PDF." },
      { status: 400 },
    );
  }

  const baseName = file.name.replace(/\.pdf$/i, "") || "document";
  const provider = getPdfCompressionProvider();
  const ghostscriptReady =
    isGhostscriptConfigured() && (await provider.isConfigured());

  try {
    if (ghostscriptReady) {
      const result = await compressPdfWithProvider({
        input,
        level: mapLegacyCompressionLevel(level),
      });

      return new NextResponse(new Uint8Array(result.output), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(baseName)}-compressed.pdf"`,
          "Cache-Control": "no-store",
          "X-Scanonix-Provider": result.provider,
          "X-Scanonix-Page-Count": String(result.outputPageCount),
        },
      });
    }

    const inputArrayBuffer = input.buffer.slice(
      input.byteOffset,
      input.byteOffset + input.byteLength,
    ) as ArrayBuffer;
    const compressed = await compressPdfBytes(inputArrayBuffer, level);
    const pdfDoc = await PDFDocument.load(compressed, { ignoreEncryption: true });

    return new NextResponse(new Uint8Array(compressed), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(baseName)}-compressed.pdf"`,
        "Cache-Control": "no-store",
        "X-Scanonix-Provider": "pdf-lib",
        "X-Scanonix-Page-Count": String(pdfDoc.getPageCount()),
      },
    });
  } catch (error) {
    if (error instanceof PdfCompressionNotConfiguredError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    if (error instanceof PdfCompressionFailedError) {
      return NextResponse.json(
        { error: error.message, code: "COMPRESSION_FAILED" },
        { status: 422 },
      );
    }

    if (error instanceof PdfCompressionError) {
      const status =
        error.code === "TOO_LARGE" ? 413 : error.code === "PASSWORD" ? 422 : 422;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status },
      );
    }

    return NextResponse.json(
      { error: "PDF compression failed unexpectedly." },
      { status: 500 },
    );
  }
}
