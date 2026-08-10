import type {
  FileAnalyzerCategory,
  FileFormatFamily,
} from "@/lib/scan/file/constants";

export interface FileMetadata {
  fileName: string;
  extension: string;
  mimeType: string;
  detectedMimeType: string;
  sizeBytes: number;
  sha256: string;
  md5: string;
  uploadedAt: string;
  lastModified: string | null;
  formatFamily: FileFormatFamily;
  formatSupported: boolean;
}

export interface FileAnalysisMatch {
  id: string;
  category: FileAnalyzerCategory;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  whyItMatters: string;
  evidence: string;
  recommendation: string;
  confidence: "high" | "medium" | "low";
  affectedResource: string;
  fixDifficulty?: "easy" | "moderate" | "hard";
}

export interface FileIntelligenceResult {
  metadata: FileMetadata;
  matches: FileAnalysisMatch[];
  extractedMetadata: Record<string, string | number | boolean | string[]>;
  checksCompleted: number;
  checksTotal: number;
  durationMs: number;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  confidence: number;
  summary: string;
  recommendations: string[];
}

export interface FileAnalysisContext {
  buffer: Buffer;
  metadata: FileMetadata;
  textPreview: string;
  budgetStartedAt: number;
}

export interface RunFileIntelligenceInput {
  scanId: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  fileBuffer: Buffer;
  lastModified?: number | null;
  maxUploadBytes: number;
}
