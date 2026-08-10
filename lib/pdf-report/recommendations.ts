import type { ScanReport } from "@/lib/scan-report/types";

export function buildFinalRecommendations(report: ScanReport): string[] {
  if (report.aiAnalysis?.longTermRecommendations.length) {
    const combined = [
      ...report.aiAnalysis.immediateActions,
      ...report.aiAnalysis.longTermRecommendations,
    ];
    const unique = [...new Set(combined.map((item) => item.trim()).filter(Boolean))];
    if (unique.length > 0) {
      return unique.slice(0, 8);
    }
  }

  const actionableFindings = report.findings.filter(
    (finding) => finding.severity !== "info",
  );

  if (actionableFindings.length === 0 || report.riskScore <= 25) {
    return [
      "No security issues were detected during this scan.",
      "Maintain regular scanning after deployments, dependency updates, and infrastructure changes.",
      "Enable continuous monitoring for production targets and review access controls quarterly.",
      "Keep TLS certificates, security headers, and patch levels up to date.",
    ];
  }

  const fromFindings = actionableFindings
    .map((finding) => finding.recommendation.trim())
    .filter(Boolean);

  const unique = [...new Set(fromFindings)];

  if (unique.length >= 3) {
    return unique.slice(0, 6);
  }

  return [
    ...unique,
    "Prioritize remediation starting with critical and high severity findings.",
    "Re-run the scan after fixes to validate risk reduction.",
  ].slice(0, 6);
}
