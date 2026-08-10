import type { ScanReport } from "@/lib/scan-report/types";

export function getSuggestedQuestions(report: ScanReport): string[] {
  const questions = [
    "Summarise this scan report for me.",
    "What should I fix first?",
    "Why was this risk score assigned?",
  ];

  if (report.findings.some((f) => f.severity === "critical" || f.severity === "high")) {
    questions.push("Compare findings by severity.");
  }

  if (report.targetType === "website") {
    questions.push("Explain the domain reputation results.");
    if (report.intelligence?.threatAnalysis?.matches) {
      questions.push("What did the threat analysis find?");
    }
  }

  if (report.targetType === "file") {
    questions.push("Explain the file intelligence results.");
  }

  questions.push("Generate a developer remediation checklist.");
  questions.push("Write an executive summary.");

  return questions.slice(0, 6);
}
