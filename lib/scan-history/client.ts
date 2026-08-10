import type {
  ScanHistoryListResponse,
  ScanHistoryQuery,
  ScanHistoryRecord,
  ScanHistorySummary,
} from "@/lib/scan-history/types";
import { notifyScanHistoryUpdated } from "@/lib/scan-history/events";
import { buildScanHistoryQueryString } from "@/lib/scan-history/utils";
import type { ScanReport } from "@/lib/scan-report/types";

export async function fetchScanHistorySummary(): Promise<ScanHistorySummary | null> {
  const response = await fetch("/api/scan-history/summary", { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as ScanHistorySummary;
}

export async function fetchScanHistoryList(
  query: ScanHistoryQuery,
): Promise<ScanHistoryListResponse | { error: string }> {
  const response = await fetch(`/api/scan-history${buildScanHistoryQueryString(query)}`, {
    cache: "no-store",
  });

  const data = await response.json();
  if (!response.ok) {
    return { error: data.error ?? "Could not load scan history." };
  }

  return data as ScanHistoryListResponse;
}

export async function deleteScanHistoryItem(id: string): Promise<{ ok: true } | { error: string }> {
  const response = await fetch(`/api/scan-history/${id}`, { method: "DELETE" });
  const data = await response.json();

  if (!response.ok) {
    return { error: data.error ?? "Could not delete scan." };
  }

  return { ok: true };
}

export async function fetchScanHistoryItem(
  id: string,
  includeReport = false,
): Promise<{ record: ScanHistoryRecord; report?: unknown } | { error: string }> {
  const suffix = includeReport ? "?include=report" : "";
  const response = await fetch(`/api/scan-history/${id}${suffix}`, { cache: "no-store" });
  const data = await response.json();

  if (!response.ok) {
    return { error: data.error ?? "Could not load scan." };
  }

  return data as { record: ScanHistoryRecord; report?: unknown };
}

export async function authorizeReportExport(
  format: "pdf" | "json",
): Promise<{ ok: true } | { error: string; status: number }> {
  const response = await fetch("/api/reports/authorize-export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { error: data.error ?? "Export not authorized.", status: response.status };
  }

  return { ok: true };
}

export interface RunSecurityScanInput {
  scanId: string;
  targetType: "website";
  target?: string;
}

export interface RunSecurityScanResponse {
  record: ScanHistoryRecord;
  report: ScanReport | null;
  duplicate?: boolean;
  error?: string;
}

export async function runSecurityScan(
  input: RunSecurityScanInput,
): Promise<RunSecurityScanResponse | { error: string; status: number }> {
  const response = await fetch("/api/scans/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as RunSecurityScanResponse & { error?: string };

  if (!response.ok) {
    if (data.record) {
      notifyScanHistoryUpdated({ scanId: data.record.id });
      return data;
    }

    return {
      error: data.error ?? "Scan failed.",
      status: response.status,
    };
  }

  notifyScanHistoryUpdated({ scanId: data.record.id });
  return data;
}
