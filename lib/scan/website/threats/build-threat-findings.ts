import type { ScanReportFinding } from "@/lib/scan-report/types";
import type { ThreatMatch } from "@/lib/scan/website/threats/types";

const CONFIDENCE_SCORE: Record<ThreatMatch["confidence"], number> = {
  high: 90,
  medium: 70,
  low: 50,
};

export function threatMatchToFinding(match: ThreatMatch, index: number): ScanReportFinding {
  const confidenceScore = CONFIDENCE_SCORE[match.confidence];

  return {
    id: `threat-${match.category}-${match.id}-${index}`,
    severity: match.severity,
    title: match.title,
    description: match.description,
    affectedFile: match.affectedResource,
    whyItMatters: match.whyItMatters,
    recommendation: match.recommendation,
    fixDifficulty: match.fixDifficulty ?? "moderate",
    evidence: match.evidence,
    confidence: confidenceScore,
    category: match.category,
  };
}

export function buildThreatFindings(matches: ThreatMatch[]): ScanReportFinding[] {
  const seen = new Set<string>();
  const findings: ScanReportFinding[] = [];

  for (const [index, match] of matches.entries()) {
    const dedupeKey = `${match.id}:${match.affectedResource}:${match.evidence.slice(0, 40)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    findings.push(threatMatchToFinding(match, index));
  }

  return findings;
}

export function dedupeFindings(findings: ScanReportFinding[]): ScanReportFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = finding.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
