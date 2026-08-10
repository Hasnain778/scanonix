import type { ScanReportFinding } from "@/lib/scan-report/types";
import type { DomainReputationMatch } from "@/lib/scan/website/domain-reputation/types";

const CONFIDENCE_SCORE: Record<DomainReputationMatch["confidence"], number> = {
  high: 90,
  medium: 70,
  low: 50,
};

export function domainMatchToFinding(match: DomainReputationMatch): ScanReportFinding {
  return {
    id: match.id,
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

export function buildDomainReputationFindings(
  matches: DomainReputationMatch[],
): ScanReportFinding[] {
  const seen = new Set<string>();
  const findings: ScanReportFinding[] = [];

  for (const match of matches) {
    const key = match.id;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push(domainMatchToFinding(match));
  }

  return findings;
}
