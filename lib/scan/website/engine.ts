import { buildFindingsFromIntelligence } from "@/lib/scan/website/build-findings";
import { buildWebsiteScanReport } from "@/lib/scan/website/build-website-report";
import { analyzeCookies } from "@/lib/scan/website/cookies";
import {
  buildDomainReputationFindings,
  runDomainReputationAnalysis,
} from "@/lib/scan/website/domain-reputation";
import { fetchWebsite } from "@/lib/scan/website/fetch";
import { analyzeSecurityHeaders } from "@/lib/scan/website/headers";
import { analyzePage } from "@/lib/scan/website/page-analysis";
import { analyzeRedirects } from "@/lib/scan/website/redirects";
import {
  buildRiskSummary,
  calculateConfidence,
  calculateRiskScore,
  deriveRiskLevel,
  mergeRiskScores,
} from "@/lib/scan/website/scoring";
import { inspectSslForUrl } from "@/lib/scan/website/ssl";
import { detectTechnologies } from "@/lib/scan/website/technology";
import { buildThreatFindings, dedupeFindings } from "@/lib/scan/website/threats/build-threat-findings";
import { runThreatAnalysis } from "@/lib/scan/website/threats/engine";
import type { WebsiteIntelligence } from "@/lib/scan/website/types";
import type { ScanReport } from "@/lib/scan-report/types";
import type { RunWebsiteScanInput } from "@/lib/scan/types";

const INTELLIGENCE_CHECKS_TOTAL = 9;
const THREAT_CHECKS_TOTAL = 6;
const DOMAIN_REPUTATION_CHECKS_TOTAL = 5;

export async function runWebsiteIntelligenceScan(
  input: RunWebsiteScanInput,
): Promise<ScanReport> {
  const started = Date.now();
  let checksCompleted = 0;
  const checksTotal =
    INTELLIGENCE_CHECKS_TOTAL + THREAT_CHECKS_TOTAL + DOMAIN_REPUTATION_CHECKS_TOTAL;

  const http = await fetchWebsite(input.target);
  checksCompleted += 1;

  const ssl = await inspectSslForUrl(http.finalUrl);
  checksCompleted += 1;

  const securityHeaders = analyzeSecurityHeaders({
    headers: http.headers,
    finalUrl: http.finalUrl,
  });
  checksCompleted += 1;

  const cookies = analyzeCookies({
    rawHeaderLines: http.rawHeaderLines,
    isHttps: http.finalUrl.startsWith("https://"),
  });
  checksCompleted += 1;

  const redirectAnalysis = analyzeRedirects(http.inputUrl, http.finalUrl, http.redirectChain);
  checksCompleted += 1;

  const pageAnalysis = http.body
    ? analyzePage(http.body, http.finalUrl)
    : {
        scriptCount: 0,
        externalScriptCount: 0,
        inlineScriptCount: 0,
        iframeCount: 0,
        formCount: 0,
        externalLinkCount: 0,
        imageCount: 0,
        stylesheetCount: 0,
      };
  checksCompleted += 1;

  const technologies = detectTechnologies(http.headers, http.body, http.rawHeaderLines);
  checksCompleted += 1;

  const domainReputationResult = await runDomainReputationAnalysis({
    finalUrl: http.finalUrl,
    ipAddress: http.ipAddress,
    redirectSuspicious: redirectAnalysis.suspiciousChain,
    redirectNotes: redirectAnalysis.notes,
    pageTitle: http.pageTitle,
    budgetStartedAt: started,
  });
  checksCompleted += domainReputationResult.checksCompleted;

  const partialIntelligence: WebsiteIntelligence = {
    inputUrl: http.inputUrl,
    finalUrl: http.finalUrl,
    httpStatus: http.status,
    responseTimeMs: http.responseTimeMs,
    ipAddress: http.ipAddress,
    redirectChain: http.redirectChain,
    redirectAnalysis,
    serverHeader: http.serverHeader,
    poweredByHeader: http.poweredByHeader,
    contentType: http.contentType,
    pageTitle: http.pageTitle,
    metaDescription: http.metaDescription,
    canonicalUrl: http.canonicalUrl,
    ssl,
    securityHeaders,
    cookies,
    pageAnalysis,
    technologies,
    responseHeaders: http.headers,
    domainReputation: {
      domain: domainReputationResult.domain,
      reputationScore: domainReputationResult.reputationScore,
      trustLevel: domainReputationResult.trustLevel,
      summary: domainReputationResult.summary,
      riskReasons: domainReputationResult.riskReasons,
      durationMs: domainReputationResult.durationMs,
      registration: {
        whoisAvailable: domainReputationResult.registration.whoisAvailable,
        registrar: domainReputationResult.registration.registrar,
        createdDate: domainReputationResult.registration.createdDate,
        expiresDate: domainReputationResult.registration.expiresDate,
        ageDays: domainReputationResult.registration.ageDays,
      },
      dnsHealth: domainReputationResult.dnsHealth,
      infrastructure: domainReputationResult.infrastructure,
      dns: domainReputationResult.dns,
      externalProviders: domainReputationResult.externalProviders,
    },
    checksCompleted,
    checksTotal,
    intelligenceRiskScore: 0,
    threatRiskScore: 0,
    domainReputationRiskScore: 0,
    riskScore: 0,
    riskLevel: "low",
    confidence: 0,
    summary: "",
  };

  const intelligenceFindings = buildFindingsFromIntelligence(partialIntelligence);
  checksCompleted += 1;

  const threatResult = await runThreatAnalysis({
    html: http.body,
    finalUrl: http.finalUrl,
    pageHost: http.finalUrl,
    budgetStartedAt: started,
  });
  checksCompleted += threatResult.checksCompleted;

  const threatFindings = buildThreatFindings(threatResult.matches);
  const domainReputationFindings = buildDomainReputationFindings(domainReputationResult.matches);
  const findings = dedupeFindings([
    ...intelligenceFindings,
    ...threatFindings,
    ...domainReputationFindings,
  ]);

  const intelligenceRiskScore = calculateRiskScore(intelligenceFindings);
  const threatRiskScore = calculateRiskScore(threatFindings);
  const domainReputationRiskScore = calculateRiskScore(domainReputationFindings);
  const riskScore = mergeRiskScores(
    intelligenceRiskScore,
    threatRiskScore,
    domainReputationRiskScore,
  );
  const riskLevel = deriveRiskLevel(riskScore);
  const confidence = calculateConfidence(checksCompleted, checksTotal);
  const summary = buildRiskSummary(findings, riskScore, technologies, {
    intelligenceScore: intelligenceRiskScore,
    threatScore: threatRiskScore,
    domainReputationScore: domainReputationRiskScore,
  });

  const intelligence: WebsiteIntelligence = {
    ...partialIntelligence,
    threatAnalysis: {
      matches: threatResult.matches.length,
      scriptsAnalyzed: threatResult.scriptsAnalyzed,
      externalScriptsFetched: threatResult.externalScriptsFetched,
      bytesAnalyzed: threatResult.bytesAnalyzed,
      durationMs: threatResult.durationMs,
    },
    checksCompleted,
    intelligenceRiskScore,
    threatRiskScore,
    domainReputationRiskScore,
    riskScore,
    riskLevel,
    confidence,
    summary,
  };

  return buildWebsiteScanReport({
    id: input.scanId,
    durationMs: Date.now() - started,
    findings,
    intelligence,
  });
}
