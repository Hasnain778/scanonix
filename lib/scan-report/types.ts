export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export type FixDifficulty = "easy" | "moderate" | "hard";

export interface ScanReportReference {
  label: string;
  url: string;
}

export interface ScanReportFinding {
  id: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  affectedFile: string;
  whyItMatters: string;
  recommendation: string;
  fixDifficulty: FixDifficulty;
  references?: ScanReportReference[];
  /** Evidence snippet from static/threat analysis (Phase 2). */
  evidence?: string;
  /** Analyst confidence score 0–100 when available. */
  confidence?: number;
  /** Threat or intelligence category tag. */
  category?: string;
  ai?: {
    plainEnglishExplanation: string;
    whyItMatters: string;
    businessImpact: string;
    technicalImpact: string;
    remediationSteps: string[];
    estimatedDifficulty: FixDifficulty;
    estimatedRiskReduction: number;
    confidenceExplanation: string;
    priority: "critical" | "high" | "medium" | "low";
    /** Legacy fields used by existing UI/PDF surfaces */
    whatHappened: string;
    whyDangerous: string;
    howToFix: string;
    source: "ai" | "deterministic";
  };
}

export interface ScanReportTimelineStage {
  id: string;
  label: string;
  completed: boolean;
}

export interface ScanReportFilesSummary {
  scanned: number;
  suspicious: number;
  safe: number;
  ignored: number;
}

export interface ScanReportPerformance {
  durationMs: number;
  filesProcessed: number;
  averageSpeedPerSecond: number;
  aiTokensUsed?: number | null;
}

export interface ScanReportSummary {
  criticalIssues: number;
  warnings: number;
  passedChecks: number;
  aiConfidence: number;
}

/** Optional structured intelligence payload for website scans (stored in report_data). */
export interface ScanReportIntelligence {
  inputUrl: string;
  finalUrl: string;
  httpStatus: number;
  responseTimeMs: number;
  ipAddress: string | null;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  confidence: number;
  summary: string;
  pageTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  serverHeader: string | null;
  poweredByHeader: string | null;
  ssl: {
    enabled: boolean;
    valid: boolean;
    daysRemaining: number | null;
    issuer: string | null;
    tlsVersion: string | null;
  };
  technologies: { name: string; confidence: string }[];
  pageAnalysis: {
    scriptCount: number;
    externalScriptCount: number;
    formCount: number;
    externalLinkCount: number;
  };
  redirectChain: { url: string; status: number; durationMs: number }[];
  threatAnalysis?: {
    matches: number;
    scriptsAnalyzed: number;
    externalScriptsFetched: number;
    bytesAnalyzed: number;
    intelligenceRiskScore: number;
    threatRiskScore: number;
  };
  domainReputation?: {
    domain: string;
    reputationScore: number;
    trustLevel: "high" | "moderate" | "low" | "poor";
    summary: string;
    riskReasons: string[];
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
      ns: string[];
    };
    externalProviders: {
      provider: string;
      configured: boolean;
      result: "clean" | "suspicious" | "unknown" | "skipped";
    }[];
  };
}

export interface ScanReportFileIntelligence {
  fileName: string;
  extension: string;
  mimeType: string;
  detectedMimeType: string;
  sizeBytes: number;
  sha256: string;
  md5: string;
  uploadedAt: string;
  lastModified: string | null;
  formatFamily: string;
  formatSupported: boolean;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  confidence: number;
  summary: string;
  recommendations: string[];
  extractedMetadata: Record<string, string | number | boolean | string[]>;
}

export interface ScanReportAiAnalysis {
  executiveSummary: string;
  technicalSummary: string;
  topPriorities: string[];
  overallSecurityPosture: string;
  immediateActions: string[];
  longTermRecommendations: string[];
  source: "ai" | "deterministic";
  generatedAt: string;
}

export interface ScanReport {
  id: string;
  target: string;
  targetType: "website" | "file";
  completedAt: string;
  durationMs: number;
  riskScore: number;
  summary: ScanReportSummary;
  findings: ScanReportFinding[];
  timeline: ScanReportTimelineStage[];
  files: ScanReportFilesSummary;
  performance: ScanReportPerformance;
  intelligence?: ScanReportIntelligence;
  fileIntelligence?: ScanReportFileIntelligence;
  aiAnalysis?: ScanReportAiAnalysis;
}
