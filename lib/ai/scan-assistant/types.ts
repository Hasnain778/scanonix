import type { AiAnalysisSource } from "@/lib/ai/scan-analysis/types";

export interface ScanAssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: AiAnalysisSource;
  createdAt: string;
}

export interface ScanAssistantContext {
  reportId: string;
  target: string;
  targetType: "website" | "file";
  riskScore: number;
  completedAt: string;
  summary: {
    criticalIssues: number;
    warnings: number;
    passedChecks: number;
    aiConfidence: number;
  };
  findings: ScanAssistantFindingContext[];
  websiteIntelligence?: {
    summary: string;
    riskLevel: string;
    httpStatus: number;
    sslEnabled: boolean;
    sslValid: boolean;
    technologies: string[];
    threatAnalysis?: {
      matches: number;
      scriptsAnalyzed: number;
      threatRiskScore: number;
    };
  };
  domainReputation?: {
    domain: string;
    reputationScore: number;
    trustLevel: string;
    summary: string;
    riskReasons: string[];
  };
  fileIntelligence?: {
    fileName: string;
    formatFamily: string;
    riskLevel: string;
    summary: string;
    recommendations: string[];
    hashes: { sha256: string; md5: string };
  };
  aiAnalysis?: {
    executiveSummary: string;
    technicalSummary: string;
    topPriorities: string[];
    overallSecurityPosture: string;
    immediateActions: string[];
    longTermRecommendations: string[];
    source: AiAnalysisSource;
  };
}

export interface ScanAssistantFindingContext {
  id: string;
  severity: string;
  title: string;
  description: string;
  category?: string;
  affectedFile: string;
  recommendation: string;
  whyItMatters: string;
  fixDifficulty: string;
  confidence?: number;
  aiSummary?: string;
}

export interface GenerateAssistantResponseInput {
  report: import("@/lib/scan-report/types").ScanReport;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  preferCloudAi: boolean;
}

export interface GenerateAssistantResponseResult {
  content: string;
  source: AiAnalysisSource;
  tokensUsed: number | null;
}

export const SCAN_ASSISTANT_LIMITS = {
  maxFindingsInContext: 20,
  maxEvidenceLength: 160,
  maxHistoryInPrompt: 10,
  maxTokens: 900,
  maxUserMessageLength: 2_000,
} as const;
