import type {
  ScanHistoryRecord,
  ScanHistoryRow,
  ScanRiskLevel,
  ScanHistoryQuery,
} from "@/lib/scan-history/types";

export function getRiskLevel(score: number): ScanRiskLevel {
  if (score <= 25) return "low";
  if (score <= 50) return "medium";
  if (score <= 75) return "high";
  return "critical";
}

export function getRiskLevelLabel(level: ScanRiskLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function getRiskLevelBadgeClass(level: ScanRiskLevel): string {
  switch (level) {
    case "low":
      return "border-emerald-500/35 bg-emerald-500/12 text-emerald-300";
    case "medium":
      return "border-yellow-500/35 bg-yellow-500/12 text-yellow-200";
    case "high":
      return "border-orange-500/35 bg-orange-500/12 text-orange-200";
    case "critical":
      return "border-red-900/50 bg-red-950/40 text-red-200";
  }
}

export function getStatusBadgeClass(status: ScanHistoryRecord["status"]): string {
  switch (status) {
    case "completed":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "processing":
      return "border-scanonix-orange/30 bg-scanonix-orange/10 text-scanonix-orange-light";
    case "failed":
      return "border-red-500/30 bg-red-500/10 text-red-300";
  }
}

export function mapScanHistoryRow(row: ScanHistoryRow): ScanHistoryRecord {
  return {
    id: row.id,
    target: row.target,
    targetType: row.target_type,
    riskScore: row.risk_score,
    riskLevel: getRiskLevel(row.risk_score),
    status: row.status,
    durationMs: row.duration_ms,
    findingsCount: row.findings_count ?? 0,
    createdAt: row.created_at,
    errorMessage: row.error_message,
  };
}

export function formatScanDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatScanDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

export function buildScanHistoryQueryString(query: ScanHistoryQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all") {
      params.set(key, String(value));
    }
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
