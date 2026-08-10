import { NextResponse } from "next/server";
import { unlockPdfWithPassword } from "@/lib/security-tools/pdf/unlock";
import {
  handleSecurityToolRequest,
  pdfDownloadResponse,
} from "@/lib/security-tools/api-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const route = "/api/tools/security/unlock-pdf";

  return handleSecurityToolRequest(request, route, "unlock-pdf", async (_ctx, formData, fileInput) => {
    const password = String(formData.get("password") ?? "");

    try {
      const output = await unlockPdfWithPassword(fileInput.buffer, password);
      const baseName = fileInput.file.name.replace(/\.pdf$/i, "") || "document";
      return pdfDownloadResponse(output, `${baseName}-unlocked.pdf`);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not unlock PDF." },
        { status: 422 },
      );
    }
  });
}
