import { analyzeFilename } from "@/lib/scan/file/analyzers/filename";
import { runFormatAnalyzers } from "@/lib/scan/file/analyzers/index";
import { buildFileFindings, dedupeFileFindings } from "@/lib/scan/file/build-findings";
import { buildFileScanReport } from "@/lib/scan/file/build-file-report";
import { FILE_LIMITS } from "@/lib/scan/file/constants";
import {
  bufferToTextPreview,
  buildFileMetadata,
  isMostlyText,
} from "@/lib/scan/file/metadata";
import {
  buildFileRecommendations,
  buildFileSummary,
  calculateFileConfidence,
  calculateFileRiskScore,
  deriveFileRiskLevel,
} from "@/lib/scan/file/scoring";
import type {
  FileAnalysisMatch,
  FileIntelligenceResult,
  RunFileIntelligenceInput,
} from "@/lib/scan/file/types";
import { ScanRunnerError } from "@/lib/scan/types";
import type { ScanReport } from "@/lib/scan-report/types";

const CHECKS_TOTAL = 5;

function validateFileInput(input: RunFileIntelligenceInput): void {
  const fileName = input.fileName.trim();
  if (!fileName) {
    throw new ScanRunnerError("invalid_target", "Select a file to scan.");
  }
  if (input.fileSize <= 0 || input.fileBuffer.length === 0) {
    throw new ScanRunnerError("invalid_target", "The selected file is empty.");
  }
  if (input.fileSize > input.maxUploadBytes) {
    throw new ScanRunnerError("invalid_target", "File exceeds your plan upload limit.");
  }
  if (input.fileBuffer.length > FILE_LIMITS.maxAnalysisBytes) {
    throw new ScanRunnerError(
      "unsupported",
      `File exceeds the ${Math.round(FILE_LIMITS.maxAnalysisBytes / (1024 * 1024))} MB analysis limit.`,
    );
  }
}

function dedupeMatches(matches: FileAnalysisMatch[]): FileAnalysisMatch[] {
  const seen = new Set<string>();
  return matches.filter((match) => {
    if (seen.has(match.id)) return false;
    seen.add(match.id);
    return true;
  });
}

export async function runFileIntelligenceScan(
  input: RunFileIntelligenceInput,
): Promise<ScanReport> {
  const started = Date.now();
  validateFileInput(input);

  const metadata = buildFileMetadata({
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    buffer: input.fileBuffer,
    lastModified: input.lastModified,
  });

  const textPreview = isMostlyText(input.fileBuffer)
    ? bufferToTextPreview(input.fileBuffer)
    : "";

  const context = {
    buffer: input.fileBuffer,
    metadata,
    textPreview,
    budgetStartedAt: started,
  };

  const filenameMatches = analyzeFilename(
    metadata.fileName,
    metadata.mimeType,
    metadata.sizeBytes,
  );

  const { matches: formatMatches, extractedMetadata } = await runFormatAnalyzers(context);
  const allMatches = dedupeMatches([
    ...filenameMatches,
    ...formatMatches,
  ]);

  if (allMatches.filter((m) => m.severity !== "info").length === 0) {
    allMatches.push({
      id: "file-clean-profile",
      category: "file-metadata",
      severity: "info",
      title: "No suspicious indicators found",
      description:
        "Static file analysis did not detect risky patterns for this format and filename.",
      whyItMatters: "Basic static checks passed; runtime behaviour was not observed.",
      evidence: `${metadata.detectedMimeType}, SHA256 ${metadata.sha256.slice(0, 16)}…`,
      recommendation: "Continue monitoring and rescan after file updates or sharing.",
      confidence: "high",
      affectedResource: metadata.fileName,
      fixDifficulty: "easy",
    });
  }

  const riskScore = calculateFileRiskScore(allMatches);
  const riskLevel = deriveFileRiskLevel(riskScore);
  const confidence = calculateFileConfidence(CHECKS_TOTAL, CHECKS_TOTAL);
  const summary = buildFileSummary({
    fileName: metadata.fileName,
    riskScore,
    matchCount: allMatches.filter((m) => m.severity !== "info").length,
    formatSupported: metadata.formatSupported,
  });
  const recommendations = buildFileRecommendations(allMatches);

  const intelligence: FileIntelligenceResult = {
    metadata,
    matches: allMatches,
    extractedMetadata: {
      ...extractedMetadata,
      sha256: metadata.sha256,
      md5: metadata.md5,
    },
    checksCompleted: CHECKS_TOTAL,
    checksTotal: CHECKS_TOTAL,
    durationMs: Date.now() - started,
    riskScore,
    riskLevel,
    confidence,
    summary,
    recommendations,
  };

  const findings = dedupeFileFindings(buildFileFindings(allMatches));

  return buildFileScanReport({
    id: input.scanId,
    durationMs: Date.now() - started,
    findings,
    intelligence,
  });
}
