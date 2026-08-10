import type { FixDifficulty } from "@/lib/scan-report/types";

export type AiAnalysisSource = "ai" | "deterministic";

export interface ScanReportFindingAi {
  plainEnglishExplanation: string;
  whyItMatters: string;
  businessImpact: string;
  technicalImpact: string;
  remediationSteps: string[];
  estimatedDifficulty: FixDifficulty;
  estimatedRiskReduction: number;
  confidenceExplanation: string;
  priority: "critical" | "high" | "medium" | "low";
  /** Legacy fields consumed by existing UI/PDF components */
  whatHappened: string;
  whyDangerous: string;
  howToFix: string;
  source: AiAnalysisSource;
}

export interface ScanReportAiAnalysis {
  executiveSummary: string;
  technicalSummary: string;
  topPriorities: string[];
  overallSecurityPosture: string;
  immediateActions: string[];
  longTermRecommendations: string[];
  source: AiAnalysisSource;
  generatedAt: string;
}

/** Compact finding payload sent to the model — structured scanner output only. */
export interface ScanFindingPromptInput {
  id: string;
  severity: string;
  title: string;
  description: string;
  affectedFile: string;
  whyItMatters: string;
  recommendation: string;
  fixDifficulty: string;
  evidence?: string;
  confidence?: number;
  category?: string;
}

export interface ScanAnalysisPromptPayload {
  target: string;
  targetType: "website" | "file";
  riskScore: number;
  findings: ScanFindingPromptInput[];
  intelligenceSummary?: string;
  domainReputationSummary?: string;
}

export interface CloudFindingAiResponse {
  id: string;
  plainEnglishExplanation: string;
  whyItMatters: string;
  businessImpact: string;
  technicalImpact: string;
  remediationSteps: string[];
  estimatedDifficulty: FixDifficulty;
  estimatedRiskReduction: number;
  confidenceExplanation: string;
  priority: "critical" | "high" | "medium" | "low";
}

export interface CloudScanAnalysisResponse {
  findings: CloudFindingAiResponse[];
  report: {
    executiveSummary: string;
    technicalSummary: string;
    topPriorities: string[];
    overallSecurityPosture: string;
    immediateActions: string[];
    longTermRecommendations: string[];
  };
}

export interface EnrichScanReportOptions {
  /** When true and a provider is configured, attempt cloud AI enhancement. */
  preferCloudAi?: boolean;
}

export const SCAN_AI_LIMITS = {
  maxFindingsInPrompt: 15,
  maxEvidenceLength: 200,
  maxTokens: 2_500,
} as const;
