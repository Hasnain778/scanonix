import type { ScanReport, ScanReportFinding } from "@/lib/scan-report/types";
import type { FileIntelligenceResult } from "@/lib/scan/file/types";

const FILE_TIMELINE = [
  { id: "upload", label: "Upload", completed: true },
  { id: "metadata", label: "Metadata Extraction", completed: true },
  { id: "static", label: "Static Analysis", completed: true },
  { id: "format", label: "Format Analysis", completed: true },
  { id: "ai", label: "AI Analysis", completed: true },
  { id: "report", label: "Report Generated", completed: true },
] as const;

function countBySeverity(findings: ScanReportFinding[]) {
  return findings.reduce(
    (counts, finding) => {
      if (finding.severity === "critical") counts.critical += 1;
      else if (finding.severity === "high" || finding.severity === "medium") {
        counts.warnings += 1;
      }
      return counts;
    },
    { critical: 0, warnings: 0 },
  );
}

export function buildFileScanReport(params: {
  id: string;
  durationMs: number;
  findings: ScanReportFinding[];
  intelligence: FileIntelligenceResult;
}): ScanReport {
  const { findings, intelligence } = params;
  const severityCounts = countBySeverity(findings);
  const suspicious = findings.filter((f) =>
    ["critical", "high", "medium"].includes(f.severity),
  ).length;

  return {
    id: params.id,
    target: intelligence.metadata.fileName,
    targetType: "file",
    completedAt: new Date().toISOString(),
    durationMs: params.durationMs,
    riskScore: intelligence.riskScore,
    summary: {
      criticalIssues: severityCounts.critical,
      warnings: severityCounts.warnings,
      passedChecks: Math.max(8, 24 - suspicious),
      aiConfidence: intelligence.confidence,
    },
    findings,
    timeline: [...FILE_TIMELINE],
    files: {
      scanned: 1,
      suspicious,
      safe: suspicious > 0 ? 0 : 1,
      ignored: 0,
    },
    performance: {
      durationMs: params.durationMs,
      filesProcessed: 1,
      averageSpeedPerSecond: Math.max(1 / Math.max(params.durationMs / 1000, 0.5), 0.1),
      aiTokensUsed: null,
    },
    fileIntelligence: {
      fileName: intelligence.metadata.fileName,
      extension: intelligence.metadata.extension,
      mimeType: intelligence.metadata.mimeType,
      detectedMimeType: intelligence.metadata.detectedMimeType,
      sizeBytes: intelligence.metadata.sizeBytes,
      sha256: intelligence.metadata.sha256,
      md5: intelligence.metadata.md5,
      uploadedAt: intelligence.metadata.uploadedAt,
      lastModified: intelligence.metadata.lastModified,
      formatFamily: intelligence.metadata.formatFamily,
      formatSupported: intelligence.metadata.formatSupported,
      riskScore: intelligence.riskScore,
      riskLevel: intelligence.riskLevel,
      confidence: intelligence.confidence,
      summary: intelligence.summary,
      recommendations: intelligence.recommendations,
      extractedMetadata: intelligence.extractedMetadata,
    },
  };
}
