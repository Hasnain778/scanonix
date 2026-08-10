import { getOwnedScanById } from "@/lib/scan-history/server";
import { isUuid } from "@/lib/scan-history/utils";
import { buildFallbackReportFromRecord } from "@/lib/scan-report/build-fallback-report";
import { getDemoReport } from "@/lib/scan-report/demo-data";
import type { ScanReport } from "@/lib/scan-report/types";

export type ReportLoadError = "not_found" | "unauthorized";

export async function loadReportForExport(
  id: string,
): Promise<{ report: ScanReport } | { error: ReportLoadError }> {
  const trimmedId = id.trim();

  const demoReport = getDemoReport(trimmedId);
  if (demoReport) {
    return { report: demoReport };
  }

  if (!isUuid(trimmedId)) {
    return { error: "not_found" };
  }

  const result = await getOwnedScanById(trimmedId, true);

  if (result.error === "unauthorized") {
    return { error: "unauthorized" };
  }

  if (result.error === "not_found") {
    return { error: "not_found" };
  }

  if (result.report) {
    return { report: result.report as ScanReport };
  }

  if (!result.record) {
    return { error: "not_found" };
  }

  return { report: buildFallbackReportFromRecord(result.record) };
}

export function isValidReportExportId(id: string): boolean {
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > 128) return false;
  if (getDemoReport(trimmed)) return true;
  return isUuid(trimmed);
}
