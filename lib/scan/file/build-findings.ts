import type { ScanReportFinding } from "@/lib/scan-report/types";
import type { FileAnalysisMatch } from "@/lib/scan/file/types";

const CONFIDENCE_SCORE: Record<FileAnalysisMatch["confidence"], number> = {
  high: 90,
  medium: 70,
  low: 50,
};

export function fileMatchToFinding(match: FileAnalysisMatch): ScanReportFinding {
  return {
    id: `file-${match.id}`,
    severity: match.severity,
    title: match.title,
    description: match.description,
    affectedFile: match.affectedResource,
    whyItMatters: match.whyItMatters,
    recommendation: match.recommendation,
    fixDifficulty: match.fixDifficulty ?? "moderate",
    evidence: match.evidence,
    confidence: CONFIDENCE_SCORE[match.confidence],
    category: match.category,
  };
}

export function buildFileFindings(matches: FileAnalysisMatch[]): ScanReportFinding[] {
  const seen = new Set<string>();
  return matches
    .filter((match) => {
      if (seen.has(match.id)) return false;
      seen.add(match.id);
      return true;
    })
    .map(fileMatchToFinding);
}

export function dedupeFileFindings(findings: ScanReportFinding[]): ScanReportFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    if (seen.has(finding.id)) return false;
    seen.add(finding.id);
    return true;
  });
}
