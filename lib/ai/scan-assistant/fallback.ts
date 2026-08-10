import { buildDeterministicReportAnalysis } from "@/lib/ai/scan-analysis/fallback";
import { getRiskLevel } from "@/lib/scan-history/utils";
import type { ScanAssistantContext } from "@/lib/ai/scan-assistant/types";
import type { ScanReport } from "@/lib/scan-report/types";

function normalizeQuestion(message: string): string {
  return message.trim().toLowerCase();
}

function explainRiskScore(context: ScanAssistantContext): string {
  const level = getRiskLevel(context.riskScore);
  const critical = context.findings.filter((f) => f.severity === "critical").length;
  const high = context.findings.filter((f) => f.severity === "high").length;
  const medium = context.findings.filter((f) => f.severity === "medium").length;
  const low = context.findings.filter((f) => f.severity === "low").length;

  const parts = [
    `The scan assigned a **${level}** risk score of **${context.riskScore}/100** based on verified scanner findings only.`,
    `Breakdown: ${critical} critical, ${high} high, ${medium} medium, ${low} low severity finding${context.findings.length === 1 ? "" : "s"}.`,
  ];

  if (context.websiteIntelligence) {
    parts.push(
      `Website intelligence risk level: ${context.websiteIntelligence.riskLevel}. ${context.websiteIntelligence.summary}`,
    );
  }

  if (context.domainReputation) {
    parts.push(
      `Domain reputation: ${context.domainReputation.trustLevel} trust (${context.domainReputation.reputationScore}/100). ${context.domainReputation.summary}`,
    );
  }

  if (context.fileIntelligence) {
    parts.push(
      `File intelligence risk level: ${context.fileIntelligence.riskLevel}. ${context.fileIntelligence.summary}`,
    );
  }

  if (context.websiteIntelligence?.threatAnalysis) {
    parts.push(
      `Threat analysis matched ${context.websiteIntelligence.threatAnalysis.matches} pattern(s) across ${context.websiteIntelligence.threatAnalysis.scriptsAnalyzed} script(s).`,
    );
  }

  parts.push(
    "This score reflects the structured findings in your report — it is not an estimate of active compromise.",
  );

  return parts.join("\n\n");
}

function compareBySeverity(context: ScanAssistantContext): string {
  const groups = ["critical", "high", "medium", "low", "info"] as const;
  const sections = groups
    .map((severity) => {
      const items = context.findings.filter((f) => f.severity === severity);
      if (items.length === 0) return null;
      const lines = items.map((f) => `- ${f.title}: ${f.description}`);
      return `**${severity.toUpperCase()} (${items.length})**\n${lines.join("\n")}`;
    })
    .filter(Boolean);

  if (sections.length === 0) {
    return "The scan did not report any findings to compare.";
  }

  return `Findings grouped by severity:\n\n${sections.join("\n\n")}`;
}

function developerChecklist(context: ScanAssistantContext): string {
  const actionable = context.findings.filter((f) => f.severity !== "info");
  if (actionable.length === 0) {
    return "No remediation checklist is required — the scanner reported no actionable issues.";
  }

  return actionable
    .map((finding, index) => {
      const steps = finding.aiSummary
        ? finding.aiSummary
        : finding.recommendation;
      return `${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}\n   - Difficulty: ${finding.fixDifficulty}\n   - Action: ${steps}`;
    })
    .join("\n\n");
}

function domainReputationAnswer(context: ScanAssistantContext): string | null {
  if (!context.domainReputation) {
    return "Domain reputation data is not available for this scan.";
  }

  const { domainReputation: rep } = context;
  const reasons =
    rep.riskReasons.length > 0
      ? `\n\nRisk signals:\n${rep.riskReasons.map((r) => `- ${r}`).join("\n")}`
      : "";

  return `Domain **${rep.domain}** has a reputation score of **${rep.reputationScore}/100** (${rep.trustLevel} trust).\n\n${rep.summary}${reasons}`;
}

function threatAnalysisAnswer(context: ScanAssistantContext): string | null {
  const threat = context.websiteIntelligence?.threatAnalysis;
  if (!threat) {
    return "Threat analysis statistics are not available for this scan.";
  }

  const related = context.findings
    .filter((f) => f.category?.toLowerCase().includes("threat") || f.title.toLowerCase().includes("script"))
    .slice(0, 5);

  const findingLines =
    related.length > 0
      ? `\n\nRelated findings:\n${related.map((f) => `- [${f.severity}] ${f.title}`).join("\n")}`
      : "";

  return `Threat analysis scanned **${threat.scriptsAnalyzed}** script(s) and matched **${threat.matches}** threat pattern(s). Threat risk component: **${threat.threatRiskScore}/100**.${findingLines}`;
}

function fileIntelligenceAnswer(context: ScanAssistantContext): string | null {
  if (!context.fileIntelligence) {
    return "File intelligence data is not available for this scan.";
  }

  const file = context.fileIntelligence;
  const recs =
    file.recommendations.length > 0
      ? `\n\nRecommendations:\n${file.recommendations.map((r) => `- ${r}`).join("\n")}`
      : "";

  return `File **${file.fileName}** (${file.formatFamily}) — risk level **${file.riskLevel}**.\n\n${file.summary}${recs}`;
}

function summariseReport(report: ScanReport, context: ScanAssistantContext): string {
  if (context.aiAnalysis) {
    return `${context.aiAnalysis.executiveSummary}\n\n**Technical overview:** ${context.aiAnalysis.technicalSummary}\n\n**Top priorities:**\n${context.aiAnalysis.topPriorities.map((p) => `- ${p}`).join("\n")}`;
  }

  const analysis = buildDeterministicReportAnalysis(report);
  return `${analysis.executiveSummary}\n\n**Technical overview:** ${analysis.technicalSummary}\n\n**Top priorities:**\n${analysis.topPriorities.map((p) => `- ${p}`).join("\n")}`;
}

function prioritiseFixes(context: ScanAssistantContext): string {
  const actionable = context.findings.filter((f) => f.severity !== "info");
  if (actionable.length === 0) {
    return "No fixes are required based on scanner findings.";
  }

  const intro = "Recommended fix order (highest severity first):";
  const items = actionable.map(
    (finding, index) =>
      `${index + 1}. [${finding.severity.toUpperCase()}] **${finding.title}** — ${finding.recommendation}`,
  );

  if (context.aiAnalysis?.immediateActions.length) {
    items.push(
      "",
      "**Immediate actions from scan analysis:**",
      ...context.aiAnalysis.immediateActions.map((action) => `- ${action}`),
    );
  }

  return [intro, ...items].join("\n");
}

function explainFinding(context: ScanAssistantContext, message: string): string | null {
  const match = context.findings.find((finding) =>
    message.toLowerCase().includes(finding.title.toLowerCase()),
  );

  if (!match) return null;

  const aiPart = match.aiSummary ? `\n\n**Analysis:** ${match.aiSummary}` : "";
  return `**${match.title}** [${match.severity}]\n\n${match.description}\n\n**Why it matters:** ${match.whyItMatters}\n\n**Recommendation:** ${match.recommendation}${aiPart}`;
}

export function generateDeterministicAssistantResponse(
  report: ScanReport,
  context: ScanAssistantContext,
  userMessage: string,
): string {
  const question = normalizeQuestion(userMessage);

  if (/summaris|summary|overview|report/.test(question)) {
    return summariseReport(report, context);
  }

  if (/priorit|fix first|what should i fix|urgent|immediate/.test(question)) {
    return prioritiseFixes(context);
  }

  if (/risk score|why.*score|how.*score/.test(question)) {
    return explainRiskScore(context);
  }

  if (/executive/.test(question)) {
    const summary = context.aiAnalysis?.executiveSummary ?? buildDeterministicReportAnalysis(report).executiveSummary;
    return summary;
  }

  if (/developer|checklist|remediation/.test(question)) {
    return developerChecklist(context);
  }

  if (/compare|severity|group/.test(question)) {
    return compareBySeverity(context);
  }

  if (/domain reputation|reputation|trust level|dns|whois/.test(question)) {
    return domainReputationAnswer(context) ?? "Domain reputation data is not available for this scan.";
  }

  if (/threat analysis|threat|javascript|script/.test(question)) {
    return threatAnalysisAnswer(context) ?? "Threat analysis data is not available for this scan.";
  }

  if (/file intelligence|uploaded file|malware|hash/.test(question)) {
    return fileIntelligenceAnswer(context) ?? "File intelligence data is not available for this scan.";
  }

  const findingAnswer = explainFinding(context, userMessage);
  if (findingAnswer) {
    return findingAnswer;
  }

  if (/technical term|explain.*term|what does.*mean/.test(question)) {
    return [
      "I can explain terms related to findings in this scan. Here are the main areas covered:",
      context.websiteIntelligence ? "- Website intelligence (HTTP, SSL, technologies)" : null,
      context.domainReputation ? "- Domain reputation and DNS health" : null,
      context.websiteIntelligence?.threatAnalysis ? "- Threat analysis (HTML/JS patterns)" : null,
      context.fileIntelligence ? "- File intelligence (format, metadata, hashes)" : null,
      `- ${context.findings.length} scanner finding(s) with severities and recommendations`,
      "",
      "Ask about a specific finding title or topic, and I will explain it using only this scan's data.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "I can only answer using the structured results from this scan. Here is what is available:",
    `- Target: ${context.target} (${context.targetType})`,
    `- Risk score: ${context.riskScore}/100`,
    `- Findings: ${context.findings.length}`,
    "",
    "Try asking:",
    "- Summarise this scan report",
    "- What should I fix first?",
    "- Why was this risk score assigned?",
    "- Generate a developer remediation checklist",
    "",
    "If you asked about something not in the scan data, the scanner did not report that information.",
  ].join("\n");
}
