import type { ScanReport, ScanReportFinding, ScanReportIntelligence } from "@/lib/scan-report/types";
import type { WebsiteIntelligence } from "@/lib/scan/website/types";

const WEBSITE_TIMELINE = [
  { id: "validate", label: "URL Validation", completed: true },
  { id: "fetch", label: "HTTP Collection", completed: true },
  { id: "tls", label: "TLS Inspection", completed: true },
  { id: "headers", label: "Header Analysis", completed: true },
  { id: "content", label: "Page Analysis", completed: true },
  { id: "domain-reputation", label: "Domain Reputation", completed: true },
  { id: "threats", label: "Threat Analysis", completed: true },
  { id: "report", label: "Report Generated", completed: true },
] as const;

function countBySeverity(findings: ScanReportFinding[]) {
  return findings.reduce(
    (counts, finding) => {
      if (finding.severity === "critical") counts.critical += 1;
      else if (finding.severity === "high" || finding.severity === "medium") {
        counts.warnings += 1;
      }
      return counts;
    },
    { critical: 0, warnings: 0 },
  );
}

function countPassedChecks(intelligence: WebsiteIntelligence, findings: ScanReportFinding[]): number {
  const headerPassed = intelligence.securityHeaders.filter((header) => header.present).length;
  const sslPassed = intelligence.ssl.enabled && intelligence.ssl.valid ? 1 : 0;
  const redirectPassed =
    !intelligence.redirectAnalysis.redirectLoop &&
    !intelligence.redirectAnalysis.excessiveRedirects
      ? 1
      : 0;
  const cookiePassed = intelligence.cookies.filter((cookie) => cookie.missingFlags.length === 0).length;

  return headerPassed + sslPassed + redirectPassed + cookiePassed + Math.max(0, 6 - findings.length);
}

export function buildWebsiteScanReport(params: {
  id: string;
  durationMs: number;
  findings: ScanReportFinding[];
  intelligence: WebsiteIntelligence;
}): ScanReport {
  const { findings, intelligence } = params;
  const severityCounts = countBySeverity(findings);
  const riskScore = intelligence.riskScore;
  const confidence = intelligence.confidence;

  const resourcesScanned =
    intelligence.pageAnalysis.scriptCount +
    intelligence.pageAnalysis.stylesheetCount +
    intelligence.pageAnalysis.imageCount +
    intelligence.pageAnalysis.formCount +
    (intelligence.threatAnalysis?.scriptsAnalyzed ?? 0) +
    1;

  const suspiciousResources = findings.filter((finding) =>
    ["critical", "high", "medium"].includes(finding.severity),
  ).length;

  return {
    id: params.id,
    target: intelligence.finalUrl,
    targetType: "website",
    completedAt: new Date().toISOString(),
    durationMs: params.durationMs,
    riskScore,
    summary: {
      criticalIssues: severityCounts.critical,
      warnings: severityCounts.warnings,
      passedChecks: countPassedChecks(intelligence, findings),
      aiConfidence: confidence,
    },
    findings,
    timeline: [...WEBSITE_TIMELINE],
    files: {
      scanned: resourcesScanned,
      suspicious: suspiciousResources,
      safe: Math.max(resourcesScanned - suspiciousResources, 0),
      ignored: 0,
    },
    performance: {
      durationMs: params.durationMs,
      filesProcessed: resourcesScanned,
      averageSpeedPerSecond: Math.max(
        resourcesScanned / Math.max(params.durationMs / 1000, 0.5),
        0.1,
      ),
      aiTokensUsed: null,
    },
    intelligence: mapIntelligenceForReport(intelligence),
  };
}

function mapIntelligenceForReport(intelligence: WebsiteIntelligence): ScanReportIntelligence {
  return {
    inputUrl: intelligence.inputUrl,
    finalUrl: intelligence.finalUrl,
    httpStatus: intelligence.httpStatus,
    responseTimeMs: intelligence.responseTimeMs,
    ipAddress: intelligence.ipAddress,
    riskScore: intelligence.riskScore,
    riskLevel: intelligence.riskLevel,
    confidence: intelligence.confidence,
    summary: intelligence.summary,
    pageTitle: intelligence.pageTitle,
    metaDescription: intelligence.metaDescription,
    canonicalUrl: intelligence.canonicalUrl,
    serverHeader: intelligence.serverHeader,
    poweredByHeader: intelligence.poweredByHeader,
    ssl: {
      enabled: intelligence.ssl.enabled,
      valid: intelligence.ssl.valid,
      daysRemaining: intelligence.ssl.daysRemaining,
      issuer: intelligence.ssl.issuer,
      tlsVersion: intelligence.ssl.tlsVersion,
    },
    technologies: intelligence.technologies.map((tech) => ({
      name: tech.name,
      confidence: tech.confidence,
    })),
    pageAnalysis: {
      scriptCount: intelligence.pageAnalysis.scriptCount,
      externalScriptCount: intelligence.pageAnalysis.externalScriptCount,
      formCount: intelligence.pageAnalysis.formCount,
      externalLinkCount: intelligence.pageAnalysis.externalLinkCount,
    },
    redirectChain: intelligence.redirectChain,
    threatAnalysis: intelligence.threatAnalysis
      ? {
          matches: intelligence.threatAnalysis.matches,
          scriptsAnalyzed: intelligence.threatAnalysis.scriptsAnalyzed,
          externalScriptsFetched: intelligence.threatAnalysis.externalScriptsFetched,
          bytesAnalyzed: intelligence.threatAnalysis.bytesAnalyzed,
          intelligenceRiskScore: intelligence.intelligenceRiskScore,
          threatRiskScore: intelligence.threatRiskScore,
        }
      : undefined,
    domainReputation: intelligence.domainReputation
      ? {
          domain: intelligence.domainReputation.domain,
          reputationScore: intelligence.domainReputation.reputationScore,
          trustLevel: intelligence.domainReputation.trustLevel,
          summary: intelligence.domainReputation.summary,
          riskReasons: intelligence.domainReputation.riskReasons,
          registration: intelligence.domainReputation.registration,
          dnsHealth: intelligence.domainReputation.dnsHealth,
          infrastructure: intelligence.domainReputation.infrastructure,
          dns: {
            a: intelligence.domainReputation.dns.a,
            aaaa: intelligence.domainReputation.dns.aaaa,
            mx: intelligence.domainReputation.dns.mx,
            ns: intelligence.domainReputation.dns.ns,
          },
          externalProviders: intelligence.domainReputation.externalProviders.map((entry) => ({
            provider: entry.provider,
            configured: entry.configured,
            result: entry.result,
          })),
        }
      : undefined,
  };
}
