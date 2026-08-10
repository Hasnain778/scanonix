import { renderToBuffer } from "@react-pdf/renderer";
import { ScanReportPdfDocument } from "@/lib/pdf-report/ScanReportPdfDocument";
import type { ScanReport } from "@/lib/scan-report/types";

export async function generateScanReportPdf(report: ScanReport): Promise<Buffer> {
  const buffer = await renderToBuffer(<ScanReportPdfDocument report={report} />);
  return Buffer.from(buffer);
}
