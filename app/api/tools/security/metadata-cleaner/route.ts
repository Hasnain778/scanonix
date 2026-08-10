import { NextResponse } from "next/server";
import {
  binaryDownloadResponse,
  handleSecurityToolRequest,
  pdfDownloadResponse,
} from "@/lib/security-tools/api-handler";
import { cleanPdfMetadata } from "@/lib/security-tools/pdf/metadata";
import {
  cleanImageMetadata,
  detectCleanedContentType,
} from "@/lib/security-tools/image/metadata";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const route = "/api/tools/security/metadata-cleaner";

  return handleSecurityToolRequest(
    request,
    route,
    "metadata-cleaner",
    async (_ctx, _formData, fileInput) => {
      const lowerName = fileInput.file.name.toLowerCase();

      try {
        if (lowerName.endsWith(".pdf") || fileInput.file.type === "application/pdf") {
          const output = await cleanPdfMetadata(fileInput.buffer);
          const baseName = fileInput.file.name.replace(/\.pdf$/i, "") || "document";
          return pdfDownloadResponse(output, `${baseName}-clean.pdf`);
        }

        const cleaned = cleanImageMetadata(fileInput.buffer, fileInput.file.name);
        const contentType = detectCleanedContentType(fileInput.file.name, cleaned);
        const baseName = fileInput.file.name.replace(/\.[^.]+$/, "") || "image";
        const ext = contentType === "image/png" ? ".png" : ".jpg";

        return binaryDownloadResponse(cleaned, `${baseName}-clean${ext}`, contentType);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Could not clean metadata." },
          { status: 422 },
        );
      }
    },
  );
}
