import { NextResponse } from "next/server";
import { requirePremiumAiPlan } from "@/lib/plan/access";
import { generateScanReportPdf } from "@/lib/pdf-report/generate";
import { isValidReportExportId, loadReportForExport } from "@/lib/pdf-report/load-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ReportPdfRouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: ReportPdfRouteProps) {
  const { id } = await params;
  const route = `/api/reports/${id}/pdf`;

  const access = await requirePremiumAiPlan(route);
  if (access instanceof NextResponse) {
    return access;
  }

  if (!isValidReportExportId(id)) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const loaded = await loadReportForExport(id);

  if ("error" in loaded) {
    if (loaded.error === "unauthorized") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  try {
    const pdfBuffer = await generateScanReportPdf(loaded.report);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="scanonix-report-${id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "PDF generation failed. Please try again." },
      { status: 500 },
    );
  }
}
