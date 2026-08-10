import type { ScanReport, ScanReportFinding } from "@/lib/scan-report/types";
import type {
  ScanAssistantContext,
  ScanAssistantFindingContext,
} from "@/lib/ai/scan-assistant/types";
import { SCAN_ASSISTANT_LIMITS } from "@/lib/ai/scan-assistant/types";

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function findingToContext(finding: ScanReportFinding): ScanAssistantFindingContext {
  const aiSummary = finding.ai
    ? truncate(
        `${finding.ai.plainEnglishExplanation} Priority: ${finding.ai.priority}. ${finding.ai.whyItMatters}`,
        320,
      )
    : undefined;

  return {
    id: finding.id,
    severity: finding.severity,
    title: finding.title,
    description: truncate(finding.description, 280),
    ...(finding.category ? { category: finding.category } : {}),
    affectedFile: finding.affectedFile,
    recommendation: truncate(finding.recommendation, 240),
    whyItMatters: truncate(finding.whyItMatters, 200),
    fixDifficulty: finding.fixDifficulty,
    ...(typeof finding.confidence === "number" ? { confidence: finding.confidence } : {}),
    ...(aiSummary ? { aiSummary } : {}),
  };
}

/** Compact structured context — no raw HTML or uploaded file bytes. */
export function buildScanAssistantContext(report: ScanReport): ScanAssistantContext {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;

  const findings = [...report.findings]
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, SCAN_ASSISTANT_LIMITS.maxFindingsInContext)
    .map(findingToContext);

  const context: ScanAssistantContext = {
    reportId: report.id,
    target: report.target,
    targetType: report.targetType,
    riskScore: report.riskScore,
    completedAt: report.completedAt,
    summary: report.summary,
    findings,
  };

  if (report.intelligence) {
    context.websiteIntelligence = {
      summary: truncate(report.intelligence.summary, 400),
      riskLevel: report.intelligence.riskLevel,
      httpStatus: report.intelligence.httpStatus,
      sslEnabled: report.intelligence.ssl.enabled,
      sslValid: report.intelligence.ssl.valid,
      technologies: report.intelligence.technologies.slice(0, 8).map((tech) => tech.name),
      ...(report.intelligence.threatAnalysis
        ? {
            threatAnalysis: {
              matches: report.intelligence.threatAnalysis.matches,
              scriptsAnalyzed: report.intelligence.threatAnalysis.scriptsAnalyzed,
              threatRiskScore: report.intelligence.threatAnalysis.threatRiskScore,
            },
          }
        : {}),
    };
  }

  if (report.intelligence?.domainReputation) {
    const rep = report.intelligence.domainReputation;
    context.domainReputation = {
      domain: rep.domain,
      reputationScore: rep.reputationScore,
      trustLevel: rep.trustLevel,
      summary: truncate(rep.summary, 320),
      riskReasons: rep.riskReasons.slice(0, 6),
    };
  }

  if (report.fileIntelligence) {
    const file = report.fileIntelligence;
    context.fileIntelligence = {
      fileName: file.fileName,
      formatFamily: file.formatFamily,
      riskLevel: file.riskLevel,
      summary: truncate(file.summary, 320),
      recommendations: file.recommendations.slice(0, 6),
      hashes: { sha256: file.sha256, md5: file.md5 },
    };
  }

  if (report.aiAnalysis) {
    context.aiAnalysis = {
      executiveSummary: report.aiAnalysis.executiveSummary,
      technicalSummary: report.aiAnalysis.technicalSummary,
      topPriorities: report.aiAnalysis.topPriorities.slice(0, 6),
      overallSecurityPosture: report.aiAnalysis.overallSecurityPosture,
      immediateActions: report.aiAnalysis.immediateActions.slice(0, 6),
      longTermRecommendations: report.aiAnalysis.longTermRecommendations.slice(0, 6),
      source: report.aiAnalysis.source,
    };
  }

  return context;
}
