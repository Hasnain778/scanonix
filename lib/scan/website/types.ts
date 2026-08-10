import type { FindingSeverity } from "@/lib/scan-report/types";

export interface RedirectHop {
  url: string;
  status: number;
  durationMs: number;
}

export interface HttpCollectionResult {
  inputUrl: string;
  finalUrl: string;
  status: number;
  responseTimeMs: number;
  redirectChain: RedirectHop[];
  headers: Record<string, string>;
  rawHeaderLines: string[];
  body: string;
  contentType: string | null;
  serverHeader: string | null;
  poweredByHeader: string | null;
  ipAddress: string | null;
  pageTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
}

export interface SslCertificateInfo {
  enabled: boolean;
  valid: boolean;
  subject: string | null;
  issuer: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysRemaining: number | null;
  tlsVersion: string | null;
  error: string | null;
}

export interface SecurityHeaderCheck {
  name: string;
  present: boolean;
  value: string | null;
  recommended: string;
  severity: FindingSeverity;
  notes?: string;
}

export interface CookieInspection {
  name: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string | null;
  missingFlags: string[];
  severity: FindingSeverity;
}

export interface RedirectAnalysis {
  httpToHttps: boolean;
  redirectLoop: boolean;
  excessiveRedirects: boolean;
  suspiciousChain: boolean;
  notes: string[];
}

export interface PageAnalysisResult {
  scriptCount: number;
  externalScriptCount: number;
  inlineScriptCount: number;
  iframeCount: number;
  formCount: number;
  externalLinkCount: number;
  imageCount: number;
  stylesheetCount: number;
}

export interface TechnologyMatch {
  name: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

export interface WebsiteIntelligence {
  inputUrl: string;
  finalUrl: string;
  httpStatus: number;
  responseTimeMs: number;
  ipAddress: string | null;
  redirectChain: RedirectHop[];
  redirectAnalysis: RedirectAnalysis;
  serverHeader: string | null;
  poweredByHeader: string | null;
  contentType: string | null;
  pageTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ssl: SslCertificateInfo;
  securityHeaders: SecurityHeaderCheck[];
  cookies: CookieInspection[];
  pageAnalysis: PageAnalysisResult;
  technologies: TechnologyMatch[];
  responseHeaders: Record<string, string>;
  threatAnalysis?: {
    matches: number;
    scriptsAnalyzed: number;
    externalScriptsFetched: number;
    bytesAnalyzed: number;
    durationMs: number;
  };
  domainReputation?: {
    domain: string;
    reputationScore: number;
    trustLevel: "high" | "moderate" | "low" | "poor";
    summary: string;
    riskReasons: string[];
    durationMs: number;
    registration: {
      whoisAvailable: boolean;
      registrar: string | null;
      createdDate: string | null;
      expiresDate: string | null;
      ageDays: number | null;
    };
    dnsHealth: {
      level: "healthy" | "degraded" | "broken";
      hasSpf: boolean;
      hasDmarc: boolean;
      dkimDetected: boolean;
      issues: string[];
    };
    infrastructure: {
      nameservers: string[];
      asn: string | null;
      hostingProvider: string | null;
      reverseDns: string | null;
    };
    dns: {
      a: string[];
      aaaa: string[];
      mx: string[];
      txt: string[];
      cname: string[];
      ns: string[];
    };
    externalProviders: {
      provider: string;
      configured: boolean;
      result: "clean" | "suspicious" | "unknown" | "skipped";
      detail: string | null;
    }[];
  };
  checksCompleted: number;
  checksTotal: number;
  intelligenceRiskScore: number;
  threatRiskScore: number;
  domainReputationRiskScore: number;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  confidence: number;
  summary: string;
}

export interface HeaderAnalysisInput {
  headers: Record<string, string>;
  finalUrl: string;
}

export interface CookieAnalysisInput {
  rawHeaderLines: string[];
  isHttps: boolean;
}
