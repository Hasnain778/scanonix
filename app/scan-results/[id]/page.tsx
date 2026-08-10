import { notFound } from "next/navigation";
import { ScanReportShell } from "@/components/scan-report/ScanReportShell";
import { getOwnedScanById } from "@/lib/scan-history/server";
import { buildFallbackReportFromRecord } from "@/lib/scan-report/build-fallback-report";
import { getDemoReport } from "@/lib/scan-report/demo-data";

interface ScanResultsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ScanResultsPage({ params }: ScanResultsPageProps) {
  const { id } = await params;

  const demoReport = getDemoReport(id);
  if (demoReport) {
    return <ScanReportShell report={demoReport} isDemo />;
  }

  const result = await getOwnedScanById(id, true);
  if ("error" in result) {
    notFound();
  }

  if (!result.report) {
    return <ScanReportShell report={buildFallbackReportFromRecord(result.record)} />;
  }

  return <ScanReportShell report={result.report} />;
}
