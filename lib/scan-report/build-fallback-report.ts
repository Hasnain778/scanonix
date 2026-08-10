import type { ScanHistoryRecord } from "@/lib/scan-history/types";
import type { ScanReport } from "@/lib/scan-report/types";

const BASE_TIMELINE = [
  { id: "upload", label: "Upload", completed: true },
  { id: "extract", label: "Extract", completed: true },
  { id: "static", label: "Static Analysis", completed: true },
  { id: "malware", label: "Malware Detection", completed: true },
  { id: "ai", label: "AI Analysis", completed: true },
  { id: "report", label: "Report Generated", completed: true },
] as const;

export function buildFallbackReportFromRecord(record: ScanHistoryRecord): ScanReport {
  return {
    id: record.id,
    target: record.target,
    targetType: record.targetType,
    completedAt: record.createdAt,
    durationMs: record.durationMs,
    riskScore: record.riskScore,
    summary: {
      criticalIssues: record.riskLevel === "critical" ? 1 : 0,
      warnings: record.riskScore > 25 ? 1 : 0,
      passedChecks: record.riskScore <= 25 ? 1 : 0,
      aiConfidence: 90,
    },
    findings: [],
    timeline: [...BASE_TIMELINE],
    files: {
      scanned: 1,
      suspicious: record.riskScore > 50 ? 1 : 0,
      safe: record.riskScore <= 50 ? 1 : 0,
      ignored: 0,
    },
    performance: {
      durationMs: record.durationMs,
      filesProcessed: 1,
      averageSpeedPerSecond: 1,
      aiTokensUsed: null,
    },
  };
}
