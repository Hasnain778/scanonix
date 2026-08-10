import type { FindingSeverity, ScanReport, ScanReportFinding } from "@/lib/scan-report/types";
import type {
  ScanAnalysisPromptPayload,
  ScanFindingPromptInput,
} from "@/lib/ai/scan-analysis/types";
import { SCAN_AI_LIMITS } from "@/lib/ai/scan-analysis/types";

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function findingToPromptInput(finding: ScanReportFinding): ScanFindingPromptInput {
  return {
    id: finding.id,
    severity: finding.severity,
    title: finding.title,
    description: finding.description,
    affectedFile: finding.affectedFile,
    whyItMatters: finding.whyItMatters,
    recommendation: finding.recommendation,
    fixDifficulty: finding.fixDifficulty,
    ...(finding.evidence
      ? { evidence: truncate(finding.evidence, SCAN_AI_LIMITS.maxEvidenceLength) }
      : {}),
    ...(typeof finding.confidence === "number" ? { confidence: finding.confidence } : {}),
    ...(finding.category ? { category: finding.category } : {}),
  };
}

export function buildScanAnalysisPromptPayload(report: ScanReport): ScanAnalysisPromptPayload {
  const actionable = report.findings
    .filter((finding) => finding.severity !== "info")
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const findings = actionable
    .slice(0, SCAN_AI_LIMITS.maxFindingsInPrompt)
    .map(findingToPromptInput);

  return {
    target: report.target,
    targetType: report.targetType,
    riskScore: report.riskScore,
    findings,
    ...(report.intelligence?.summary
      ? { intelligenceSummary: truncate(report.intelligence.summary, 400) }
      : {}),
    ...(report.intelligence?.domainReputation?.summary
      ? {
          domainReputationSummary: truncate(report.intelligence.domainReputation.summary, 300),
        }
      : {}),
  };
}
