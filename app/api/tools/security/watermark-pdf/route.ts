import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import {
  handleSecurityToolRequest,
  pdfDownloadResponse,
} from "@/lib/security-tools/api-handler";
import {
  parsePageSelection,
  watermarkPdf,
  type WatermarkPosition,
} from "@/lib/security-tools/pdf/watermark";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const POSITIONS = new Set<WatermarkPosition>([
  "center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "diagonal",
]);

export async function POST(request: Request) {
  const route = "/api/tools/security/watermark-pdf";

  return handleSecurityToolRequest(request, route, "watermark-pdf", async (_ctx, formData, fileInput) => {
    const text = String(formData.get("text") ?? "").trim();
    const position = String(formData.get("position") ?? "center") as WatermarkPosition;
    const opacity = Number(formData.get("opacity") ?? 0.3);
    const fontSize = Number(formData.get("fontSize") ?? 48);
    const pageSelectionRaw = String(formData.get("pageSelection") ?? "all");
    const imageFile = formData.get("image");

    let imageBytes: Buffer | undefined;
    if (imageFile instanceof File && imageFile.size > 0) {
      imageBytes = Buffer.from(await imageFile.arrayBuffer());
    }

    const pdfDoc = await PDFDocument.load(fileInput.buffer, { ignoreEncryption: true });
    const pageSelection = parsePageSelection(pageSelectionRaw, pdfDoc.getPageCount());

    try {
      const output = await watermarkPdf(fileInput.buffer, {
        text: text || undefined,
        imageBytes,
        position: POSITIONS.has(position) ? position : "center",
        opacity: Number.isFinite(opacity) ? opacity : 0.3,
        fontSize: Number.isFinite(fontSize) ? fontSize : 48,
        pageSelection,
      });

      const baseName = fileInput.file.name.replace(/\.pdf$/i, "") || "document";
      return pdfDownloadResponse(output, `${baseName}-watermarked.pdf`);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not watermark PDF." },
        { status: 422 },
      );
    }
  });
}
