import { getRiskLevel } from "@/lib/scan-history/utils";
import type { FileAnalysisMatch } from "@/lib/scan/file/types";

const SEVERITY_WEIGHTS: Record<FileAnalysisMatch["severity"], number> = {
  critical: 30,
  high: 20,
  medium: 12,
  low: 5,
  info: 1,
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateFileRiskScore(matches: FileAnalysisMatch[]): number {
  const actionable = matches.filter((match) => match.severity !== "info");
  if (actionable.length === 0) return 8;

  const weighted = actionable.reduce(
    (total, match) => total + (SEVERITY_WEIGHTS[match.severity] ?? 0),
    0,
  );
  return clampScore(weighted);
}

export function calculateFileConfidence(checksCompleted: number, checksTotal: number): number {
  if (checksTotal <= 0) return 75;
  const ratio = checksCompleted / checksTotal;
  return clampScore(Math.round(65 + ratio * 35));
}

export function buildFileSummary(params: {
  fileName: string;
  riskScore: number;
  matchCount: number;
  formatSupported: boolean;
}): string {
  const riskLevel = getRiskLevel(params.riskScore);
  if (params.matchCount === 0) {
    return `Static analysis of ${params.fileName} did not detect actionable security indicators. Risk level: ${riskLevel}.`;
  }
  const formatNote = params.formatSupported ? "" : " Limited analyzer coverage for this format.";
  return `${params.matchCount} security indicator${params.matchCount === 1 ? "" : "s"} identified in ${params.fileName} with a ${riskLevel} risk score (${params.riskScore}/100).${formatNote}`;
}

export function buildFileRecommendations(matches: FileAnalysisMatch[]): string[] {
  const recs = matches
    .filter((match) => match.severity !== "info")
    .map((match) => match.recommendation.trim())
    .filter(Boolean);

  const unique = [...new Set(recs)];
  if (unique.length >= 3) return unique.slice(0, 6);

  return [
    ...unique,
    "Re-scan after file updates or if the source is unknown.",
    "Open documents with macros disabled unless fully trusted.",
  ].slice(0, 6);
}

export function deriveFileRiskLevel(riskScore: number): "low" | "medium" | "high" | "critical" {
  return getRiskLevel(riskScore);
}
