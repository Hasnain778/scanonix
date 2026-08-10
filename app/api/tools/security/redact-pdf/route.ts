import { NextResponse } from "next/server";
import { isPdfRedactionConfigured } from "@/config/env";
import {
  handleSecurityToolRequest,
  pdfDownloadResponse,
} from "@/lib/security-tools/api-handler";
import { parseRedactionAreas } from "@/lib/security-tools/pdf/redact";
import { getPdfRedactionProvider, redactPdfWithProvider } from "@/lib/providers/pdf/redaction/pymupdf-provider";
import {
  PdfRedactionFailedError,
  PdfRedactionNotConfiguredError,
} from "@/lib/providers/pdf/redaction/types";
import { nativeProviderUnavailableMessage } from "@/lib/providers/runtime/production-guards";
import { assertPdfBytes } from "@/lib/image/validate-binary";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const route = "/api/tools/security/redact-pdf";

  const provider = getPdfRedactionProvider();
  const configured = await provider.isConfigured();
  if (!configured || !isPdfRedactionConfigured()) {
    return NextResponse.json(
      {
        error: nativeProviderUnavailableMessage("Secure PDF redaction"),
        code: "NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  return handleSecurityToolRequest(request, route, "redact-pdf", async (_ctx, formData, fileInput) => {
    const areas = parseRedactionAreas(String(formData.get("areas") ?? ""));

    try {
      assertPdfBytes(fileInput.buffer);
    } catch {
      return NextResponse.json(
        { error: "Uploaded file is not a valid PDF." },
        { status: 400 },
      );
    }

    try {
      const result = await redactPdfWithProvider({
        input: fileInput.buffer,
        areas,
      });
      const baseName = fileInput.file.name.replace(/\.pdf$/i, "") || "document";
      return pdfDownloadResponse(result.output, `${baseName}-redacted.pdf`, {
        "X-Scanonix-Provider": result.provider,
        "X-Scanonix-Page-Count": String(result.outputPageCount),
      });
    } catch (error) {
      if (error instanceof PdfRedactionNotConfiguredError) {
        return NextResponse.json(
          {
            error: error.message,
            code: "NOT_CONFIGURED",
            requiredRuntime: error.requiredRuntime,
          },
          { status: 503 },
        );
      }

      if (error instanceof PdfRedactionFailedError) {
        return NextResponse.json(
          { error: error.message, code: "REDACTION_FAILED" },
          { status: 422 },
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not redact PDF." },
        { status: 422 },
      );
    }
  });
}
