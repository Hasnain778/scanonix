import { getRiskLevel } from "@/lib/scan-history/utils";
import type {
  CloudScanAnalysisResponse,
  ScanReportAiAnalysis,
  ScanReportFindingAi,
} from "@/lib/ai/scan-analysis/types";
import type {
  FindingSeverity,
  FixDifficulty,
  ScanReport,
  ScanReportFinding,
} from "@/lib/scan-report/types";

const RISK_REDUCTION: Record<FindingSeverity, number> = {
  critical: 28,
  high: 20,
  medium: 12,
  low: 6,
  info: 2,
};

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function severityToPriority(
  severity: FindingSeverity,
): ScanReportFindingAi["priority"] {
  if (severity === "critical") return "critical";
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}

function buildBusinessImpact(finding: ScanReportFinding): string {
  switch (finding.severity) {
    case "critical":
      return `This ${finding.title.toLowerCase()} issue could disrupt operations, erode customer trust, and create regulatory or contractual exposure if exploited.`;
    case "high":
      return `If left unresolved, ${finding.title.toLowerCase()} may lead to data exposure, service abuse, or reputational damage affecting customers and stakeholders.`;
    case "medium":
      return `${finding.title} increases organisational risk and may become more serious as the environment or traffic grows.`;
    case "low":
      return `${finding.title} is a smaller exposure today but still worth addressing to maintain a strong security baseline.`;
    default:
      return `${finding.title} is informational and supports ongoing security hygiene.`;
  }
}

function buildTechnicalImpact(finding: ScanReportFinding): string {
  const category = finding.category ? ` (${finding.category})` : "";
  return `Scanner detected ${finding.title}${category} affecting ${finding.affectedFile}. ${finding.whyItMatters}`;
}

function buildConfidenceExplanation(finding: ScanReportFinding): string {
  if (typeof finding.confidence === "number") {
    if (finding.confidence >= 85) {
      return `High confidence (${finding.confidence}%) — the scanner matched strong indicators${finding.evidence ? " with supporting evidence" : ""}.`;
    }
    if (finding.confidence >= 65) {
      return `Moderate confidence (${finding.confidence}%) — the pattern is present but review the affected resource to confirm impact in your environment.`;
    }
    return `Lower confidence (${finding.confidence}%) — treat this as an indicator requiring manual verification before major changes.`;
  }

  return finding.evidence
    ? "Confidence is based on deterministic scanner pattern matching with captured evidence snippets."
    : "Confidence is based on deterministic scanner rules; validate the affected resource in your deployment context.";
}

function splitRemediationSteps(recommendation: string): string[] {
  const trimmed = recommendation.trim();
  if (!trimmed) {
    return ["Review the affected resource and apply appropriate security controls."];
  }

  const byNumber = trimmed
    .split(/\d+\.\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (byNumber.length > 1) {
    return byNumber;
  }

  const bySentence = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (bySentence.length > 1) {
    return bySentence;
  }

  return [trimmed];
}

export function buildDeterministicFindingAi(
  finding: ScanReportFinding,
): ScanReportFindingAi {
  const remediationSteps = splitRemediationSteps(finding.recommendation);
  const howToFix = remediationSteps.join(" ");

  return {
    plainEnglishExplanation: finding.description,
    whyItMatters: finding.whyItMatters,
    businessImpact: buildBusinessImpact(finding),
    technicalImpact: buildTechnicalImpact(finding),
    remediationSteps,
    estimatedDifficulty: finding.fixDifficulty,
    estimatedRiskReduction: RISK_REDUCTION[finding.severity],
    confidenceExplanation: buildConfidenceExplanation(finding),
    priority: severityToPriority(finding.severity),
    whatHappened: finding.description,
    whyDangerous: finding.whyItMatters,
    howToFix,
    source: "deterministic",
  };
}

function sortActionableFindings(findings: ScanReportFinding[]): ScanReportFinding[] {
  return [...findings]
    .filter((finding) => finding.severity !== "info")
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export function buildDeterministicReportAnalysis(
  report: ScanReport,
): ScanReportAiAnalysis {
  const actionable = sortActionableFindings(report.findings);
  const riskLevel = getRiskLevel(report.riskScore);
  const generatedAt = new Date().toISOString();

  if (actionable.length === 0) {
    return {
      executiveSummary: `Scanonix completed a ${report.targetType} scan of ${report.target} with a low risk score of ${report.riskScore}/100. No actionable security issues were reported by the scanner.`,
      technicalSummary:
        "Static intelligence and threat checks did not surface issues requiring immediate remediation. Continue monitoring after changes to code, configuration, or infrastructure.",
      topPriorities: [
        "Maintain regular scanning after deployments and dependency updates.",
      ],
      overallSecurityPosture:
        "Current posture appears strong based on scanner results, but periodic reassessment is recommended.",
      immediateActions: [
        "No urgent remediation is required based on current scanner findings.",
      ],
      longTermRecommendations: [
        "Schedule recurring scans and review TLS, headers, and access controls quarterly.",
        "Enable continuous monitoring for production targets.",
      ],
      source: "deterministic",
      generatedAt,
    };
  }

  const criticalCount = actionable.filter((f) => f.severity === "critical").length;
  const highCount = actionable.filter((f) => f.severity === "high").length;
  const topThree = actionable.slice(0, 3);

  return {
    executiveSummary: `Scanonix identified ${actionable.length} actionable issue${actionable.length === 1 ? "" : "s"} on ${report.target} with an overall ${riskLevel} risk score of ${report.riskScore}/100. ${criticalCount + highCount > 0 ? "Critical and high severity items should be prioritised to reduce business exposure." : "Focus on medium and lower severity improvements to strengthen the security baseline."}`,
    technicalSummary: `The scanner reported ${criticalCount} critical, ${highCount} high, and ${actionable.length - criticalCount - highCount} other actionable finding${actionable.length === 1 ? "" : "s"} covering configuration, client-side, and transport security signals. Each item below maps directly to a verified scanner result — no additional vulnerabilities were inferred.`,
    topPriorities: topThree.map(
      (finding) => `[${finding.severity.toUpperCase()}] ${finding.title} — ${finding.recommendation}`,
    ),
    overallSecurityPosture: `Based on scanner findings alone, security posture is ${riskLevel}. Address higher severity items first to measurably reduce the ${report.riskScore}/100 risk score.`,
    immediateActions: actionable
      .filter((finding) => finding.severity === "critical" || finding.severity === "high")
      .slice(0, 5)
      .map((finding) => `${finding.title}: ${finding.recommendation}`),
    longTermRecommendations: [
      ...actionable
        .filter((finding) => finding.severity === "medium" || finding.severity === "low")
        .slice(0, 4)
        .map((finding) => `${finding.title}: ${finding.recommendation}`),
      "Re-run the scan after remediation to validate risk reduction.",
    ].slice(0, 6),
    source: "deterministic",
    generatedAt,
  };
}

export function applyDeterministicAnalysis(report: ScanReport): ScanReport {
  const aiAnalysis = buildDeterministicReportAnalysis(report);
  const findings = report.findings.map((finding) => {
    if (finding.severity === "info") {
      return finding;
    }

    return {
      ...finding,
      ai: buildDeterministicFindingAi(finding),
    };
  });

  const actionableCount = findings.filter((f) => f.severity !== "info").length;
  const avgConfidence =
    actionableCount === 0
      ? 88
      : Math.round(
          findings
            .filter((f) => f.ai)
            .reduce((sum, f) => sum + (f.confidence ?? 75), 0) / actionableCount,
        );

  return {
    ...report,
    findings,
    aiAnalysis,
    summary: {
      ...report.summary,
      aiConfidence: avgConfidence,
    },
    performance: {
      ...report.performance,
      aiTokensUsed: report.performance.aiTokensUsed ?? 0,
    },
  };
}

export function mergeCloudAnalysis(
  report: ScanReport,
  cloud: CloudScanAnalysisResponse,
): ScanReport {
  const cloudById = new Map(cloud.findings.map((entry) => [entry.id, entry]));
  const validIds = new Set(report.findings.map((finding) => finding.id));

  const findings = report.findings.map((finding) => {
    const cloudFinding = cloudById.get(finding.id);
    if (!cloudFinding || !validIds.has(finding.id) || finding.severity === "info") {
      return finding;
    }

    const remediationSteps =
      cloudFinding.remediationSteps.length > 0
        ? cloudFinding.remediationSteps
        : splitRemediationSteps(finding.recommendation);

    const ai: ScanReportFindingAi = {
      plainEnglishExplanation: cloudFinding.plainEnglishExplanation,
      whyItMatters: cloudFinding.whyItMatters,
      businessImpact: cloudFinding.businessImpact,
      technicalImpact: cloudFinding.technicalImpact,
      remediationSteps,
      estimatedDifficulty: cloudFinding.estimatedDifficulty,
      estimatedRiskReduction: clampRiskReduction(cloudFinding.estimatedRiskReduction),
      confidenceExplanation: cloudFinding.confidenceExplanation,
      priority: cloudFinding.priority,
      whatHappened: cloudFinding.plainEnglishExplanation,
      whyDangerous: cloudFinding.whyItMatters,
      howToFix: remediationSteps.join(" "),
      source: "ai",
    };

    return { ...finding, ai };
  });

  const aiAnalysis: ScanReportAiAnalysis = {
    ...cloud.report,
    source: "ai",
    generatedAt: new Date().toISOString(),
  };

  const actionable = findings.filter((f) => f.severity !== "info" && f.ai);
  const aiConfidence =
    actionable.length === 0
      ? report.summary.aiConfidence
      : Math.round(
          actionable.reduce((sum, f) => {
            const base = f.confidence ?? 80;
            return sum + Math.min(98, base + (f.ai?.source === "ai" ? 5 : 0));
          }, 0) / actionable.length,
        );

  return {
    ...report,
    findings,
    aiAnalysis,
    summary: {
      ...report.summary,
      aiConfidence,
    },
  };
}

function clampRiskReduction(value: number): number {
  if (!Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(35, Math.round(value)));
}

function isFixDifficulty(value: string): value is FixDifficulty {
  return value === "easy" || value === "moderate" || value === "hard";
}

function isPriority(value: string): value is ScanReportFindingAi["priority"] {
  return value === "critical" || value === "high" || value === "medium" || value === "low";
}

export function parseCloudScanAnalysisResponse(
  raw: string,
  allowedFindingIds: Set<string>,
): CloudScanAnalysisResponse | null {
  try {
    const parsed = JSON.parse(raw) as CloudScanAnalysisResponse;
    if (!parsed || !Array.isArray(parsed.findings) || !parsed.report) {
      return null;
    }

    const findings = parsed.findings.filter((entry) => {
      if (!entry?.id || !allowedFindingIds.has(entry.id)) return false;
      if (
        !entry.plainEnglishExplanation ||
        !entry.whyItMatters ||
        !entry.businessImpact ||
        !entry.technicalImpact ||
        !Array.isArray(entry.remediationSteps) ||
        !entry.confidenceExplanation ||
        !isFixDifficulty(entry.estimatedDifficulty) ||
        !isPriority(entry.priority)
      ) {
        return false;
      }
      return true;
    });

    const report = parsed.report;
    if (
      !report.executiveSummary ||
      !report.technicalSummary ||
      !Array.isArray(report.topPriorities) ||
      !report.overallSecurityPosture ||
      !Array.isArray(report.immediateActions) ||
      !Array.isArray(report.longTermRecommendations)
    ) {
      return null;
    }

    return { findings, report };
  } catch {
    return null;
  }
}
