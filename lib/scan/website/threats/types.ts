import type { FindingSeverity } from "@/lib/scan-report/types";
import type { ThreatCategory } from "@/lib/scan/website/threats/constants";

export type ThreatConfidence = "high" | "medium" | "low";

export interface ExtractedScript {
  kind: "inline" | "external";
  source: string;
  content: string;
  index: number;
}

export interface ExtractedIframe {
  src: string | null;
  attributes: string;
  index: number;
}

export interface ExtractedForm {
  action: string | null;
  html: string;
  index: number;
  hidden: boolean;
  hasPasswordField: boolean;
}

export interface ThreatMatch {
  id: string;
  category: ThreatCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  whyItMatters: string;
  evidence: string;
  recommendation: string;
  confidence: ThreatConfidence;
  affectedResource: string;
  fixDifficulty?: "easy" | "moderate" | "hard";
}

export interface ThreatAnalysisResult {
  matches: ThreatMatch[];
  scriptsAnalyzed: number;
  externalScriptsFetched: number;
  bytesAnalyzed: number;
  checksCompleted: number;
  checksTotal: number;
  durationMs: number;
}

export interface ThreatAnalysisInput {
  html: string;
  finalUrl: string;
  pageHost: string;
  budgetStartedAt: number;
}
