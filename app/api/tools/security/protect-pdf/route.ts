import { NextResponse } from "next/server";
import { protectPdfWithPassword } from "@/lib/security-tools/pdf/protect";
import {
  handleSecurityToolRequest,
  pdfDownloadResponse,
} from "@/lib/security-tools/api-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const route = "/api/tools/security/protect-pdf";

  return handleSecurityToolRequest(request, route, "protect-pdf", async (_ctx, formData, fileInput) => {
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!password) {
      return NextResponse.json({ error: "Enter a password." }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    try {
      const output = await protectPdfWithPassword(fileInput.buffer, password);
      const baseName = fileInput.file.name.replace(/\.pdf$/i, "") || "document";
      return pdfDownloadResponse(output, `${baseName}-protected.pdf`);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not protect PDF." },
        { status: 422 },
      );
    }
  });
}
