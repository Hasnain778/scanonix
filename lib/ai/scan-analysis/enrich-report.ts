import { buildScanAnalysisPromptPayload } from "@/lib/ai/scan-analysis/build-input";
import {
  applyDeterministicAnalysis,
  mergeCloudAnalysis,
  parseCloudScanAnalysisResponse,
} from "@/lib/ai/scan-analysis/fallback";
import {
  buildScanAnalysisUserPrompt,
  SCAN_ANALYSIS_SYSTEM_PROMPT,
} from "@/lib/ai/scan-analysis/prompts";
import type { EnrichScanReportOptions } from "@/lib/ai/scan-analysis/types";
import { SCAN_AI_LIMITS } from "@/lib/ai/scan-analysis/types";
import { getAiProvider } from "@/lib/ai/providers";
import type { ScanReport } from "@/lib/scan-report/types";

function ensureAiTimelineStage(report: ScanReport): ScanReport {
  const hasAiStage = report.timeline.some((stage) => stage.id === "ai");
  if (hasAiStage) {
    return report;
  }

  const reportStageIndex = report.timeline.findIndex((stage) => stage.id === "report");
  const aiStage = { id: "ai", label: "AI Analysis", completed: true };
  const timeline =
    reportStageIndex >= 0
      ? [
          ...report.timeline.slice(0, reportStageIndex),
          aiStage,
          ...report.timeline.slice(reportStageIndex),
        ]
      : [...report.timeline, aiStage];

  return { ...report, timeline };
}

async function tryCloudEnhancement(report: ScanReport): Promise<ScanReport | null> {
  const provider = getAiProvider();
  if (!provider) {
    return null;
  }

  const payload = buildScanAnalysisPromptPayload(report);
  if (payload.findings.length === 0) {
    return null;
  }

  const allowedIds = new Set(payload.findings.map((finding) => finding.id));

  const result = await provider.complete(
    [
      { role: "system", content: SCAN_ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: buildScanAnalysisUserPrompt(payload) },
    ],
    {
      jsonMode: true,
      maxTokens: SCAN_AI_LIMITS.maxTokens,
      temperature: 0.2,
    },
  );

  const parsed = parseCloudScanAnalysisResponse(result.content, allowedIds);
  if (!parsed || parsed.findings.length === 0) {
    return null;
  }

  const enhanced = mergeCloudAnalysis(report, parsed);

  return {
    ...enhanced,
    performance: {
      ...enhanced.performance,
      aiTokensUsed: result.tokensUsed,
    },
  };
}

/**
 * Enriches a scan report with AI explanations derived ONLY from existing findings.
 * Always applies deterministic analysis; optionally enhances via cloud AI.
 * Never throws — returns an enriched report in all cases.
 */
export async function enrichReportWithAiAnalysis(
  report: ScanReport,
  options: EnrichScanReportOptions = {},
): Promise<ScanReport> {
  let enriched = applyDeterministicAnalysis(ensureAiTimelineStage(report));

  if (!options.preferCloudAi) {
    return enriched;
  }

  try {
    const cloudEnhanced = await tryCloudEnhancement(enriched);
    if (cloudEnhanced) {
      enriched = cloudEnhanced;
    }
  } catch {
    // Deterministic analysis already applied — report must never fail.
  }

  return enriched;
}
