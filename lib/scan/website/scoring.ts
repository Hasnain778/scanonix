import type { FindingSeverity, ScanReportFinding } from "@/lib/scan-report/types";
import { getRiskLevel } from "@/lib/scan-history/utils";
import type { WebsiteIntelligence } from "@/lib/scan/website/types";

const SEVERITY_WEIGHTS: Record<FindingSeverity, number> = {
  critical: 30,
  high: 20,
  medium: 12,
  low: 5,
  info: 1,
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Phase 1 / Phase 2 score from a finding list. */
export function calculateRiskScore(findings: ScanReportFinding[]): number {
  if (findings.length === 0) {
    return 0;
  }

  const weighted = findings.reduce((total, finding) => {
    if (finding.severity === "info") {
      return total;
    }
    return total + (SEVERITY_WEIGHTS[finding.severity] ?? 0);
  }, 0);

  return clampScore(weighted);
}

/**
 * Merge intelligence, threat, and domain reputation risk scores.
 * Preserves each input — combined score elevates when any surface is risky.
 */
export function mergeRiskScores(
  intelligenceScore: number,
  threatScore: number,
  domainReputationScore = 0,
): number {
  if (intelligenceScore === 0 && threatScore === 0 && domainReputationScore === 0) {
    return 0;
  }

  const blended =
    intelligenceScore + threatScore * 0.5 + domainReputationScore * 0.4;
  return clampScore(
    Math.max(intelligenceScore, threatScore, domainReputationScore, blended),
  );
}

export function calculateConfidence(checksCompleted: number, checksTotal: number): number {
  if (checksTotal <= 0) return 0;
  const ratio = checksCompleted / checksTotal;
  return clampScore(Math.round(60 + ratio * 40));
}

export function buildRiskSummary(
  findings: ScanReportFinding[],
  riskScore: number,
  technologies: WebsiteIntelligence["technologies"],
  options?: {
    intelligenceScore?: number;
    threatScore?: number;
    domainReputationScore?: number;
  },
): string {
  const riskLevel = getRiskLevel(riskScore);
  const issueCount = findings.filter((finding) => finding.severity !== "info").length;
  const techNames = technologies.map((tech) => tech.name).slice(0, 3);
  const threatCount = findings.filter((finding) => finding.id.startsWith("threat-")).length;
  const domainRepCount = findings.filter((finding) => finding.id.startsWith("domain-rep-")).length;

  if (issueCount === 0) {
    return `No significant security issues were detected. Risk level: ${riskLevel}.`;
  }

  const techSuffix = techNames.length > 0 ? ` Detected stack: ${techNames.join(", ")}.` : "";
  const scoreDetail =
    options?.intelligenceScore !== undefined && options?.threatScore !== undefined
      ? ` Intelligence score: ${options.intelligenceScore}. Threat score: ${options.threatScore}.${options.domainReputationScore !== undefined ? ` Domain reputation risk: ${options.domainReputationScore}.` : ""}`
      : "";
  const threatSuffix =
    threatCount > 0 ? ` Includes ${threatCount} client-side threat indicator${threatCount === 1 ? "" : "s"}.` : "";
  const domainRepSuffix =
    domainRepCount > 0
      ? ` Includes ${domainRepCount} domain reputation signal${domainRepCount === 1 ? "" : "s"}.`
      : "";

  return `${issueCount} security issue${issueCount === 1 ? "" : "s"} identified with a ${riskLevel} combined risk score (${riskScore}/100).${scoreDetail}${threatSuffix}${domainRepSuffix}${techSuffix}`;
}

export function deriveRiskLevel(riskScore: number): WebsiteIntelligence["riskLevel"] {
  return getRiskLevel(riskScore);
}
