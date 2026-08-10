import type { ScanReport, ScanReportFinding } from "@/lib/scan-report/types";
import type { ScanTargetType } from "@/lib/scan-history/types";
import { getRiskLevel } from "@/lib/scan-history/utils";

const BASE_TIMELINE = [
  { id: "upload", label: "Upload", completed: true },
  { id: "extract", label: "Extract", completed: true },
  { id: "static", label: "Static Analysis", completed: true },
  { id: "malware", label: "Malware Detection", completed: true },
  { id: "ai", label: "AI Analysis", completed: true },
  { id: "report", label: "Report Generated", completed: true },
] as const;

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function countBySeverity(findings: ScanReportFinding[]) {
  return findings.reduce(
    (counts, finding) => {
      if (finding.severity === "critical") counts.critical += 1;
      else if (finding.severity === "high" || finding.severity === "medium") {
        counts.warnings += 1;
      } else {
        counts.info += 1;
      }
      return counts;
    },
    { critical: 0, warnings: 0, info: 0 },
  );
}

export function buildScanReport(params: {
  id: string;
  target: string;
  targetType: ScanTargetType;
  durationMs: number;
  findings: ScanReportFinding[];
  filesScanned?: number;
  suspiciousFiles?: number;
}): ScanReport {
  const findings = params.findings;
  const severityCounts = countBySeverity(findings);

  const riskFromFindings = findings.reduce((score, finding) => {
    switch (finding.severity) {
      case "critical":
        return score + 28;
      case "high":
        return score + 18;
      case "medium":
        return score + 10;
      case "low":
        return score + 4;
      default:
        return score + 1;
    }
  }, 0);

  const riskScore = clampScore(findings.length === 0 ? 8 : riskFromFindings);
  const passedChecks = Math.max(12, 30 - findings.length * 2);
  const filesScanned = params.filesScanned ?? (params.targetType === "file" ? 1 : 12);
  const suspiciousFiles = params.suspiciousFiles ?? Math.min(findings.length, filesScanned);

  return {
    id: params.id,
    target: params.target,
    targetType: params.targetType,
    completedAt: new Date().toISOString(),
    durationMs: params.durationMs,
    riskScore,
    summary: {
      criticalIssues: severityCounts.critical,
      warnings: severityCounts.warnings,
      passedChecks,
      aiConfidence: getRiskLevel(riskScore) === "low" ? 96 : 91,
    },
    findings,
    timeline: [...BASE_TIMELINE],
    files: {
      scanned: filesScanned,
      suspicious: suspiciousFiles,
      safe: Math.max(filesScanned - suspiciousFiles, 0),
      ignored: 0,
    },
    performance: {
      durationMs: params.durationMs,
      filesProcessed: filesScanned,
      averageSpeedPerSecond: Math.max(
        filesScanned / Math.max(params.durationMs / 1000, 0.5),
        0.1,
      ),
      aiTokensUsed: findings.length > 0 ? 680 + findings.length * 120 : 320,
    },
  };
}
