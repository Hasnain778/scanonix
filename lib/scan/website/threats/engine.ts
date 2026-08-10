import {
  analyzeCryptoMinerCode,
  analyzeEventHandlers,
  analyzeForms,
  analyzeIframes,
  analyzeMetaRefreshRedirects,
  analyzeSuspiciousCdnUrls,
} from "@/lib/scan/website/threats/analyze-html";
import {
  analyzeJavaScriptContent,
  detectBase64ScriptBlocks,
} from "@/lib/scan/website/threats/analyze-javascript";
import { THREAT_LIMITS } from "@/lib/scan/website/threats/constants";
import { extractScripts, getHostname } from "@/lib/scan/website/threats/extract-html";
import { fetchExternalScripts } from "@/lib/scan/website/threats/fetch-external-scripts";
import type { ThreatAnalysisInput, ThreatAnalysisResult, ThreatMatch } from "@/lib/scan/website/threats/types";

const CHECKS_TOTAL = 6;

function isBudgetExceeded(startedAt: number): boolean {
  return Date.now() - startedAt > THREAT_LIMITS.analysisBudgetMs;
}

export async function runThreatAnalysis(
  input: ThreatAnalysisInput,
): Promise<ThreatAnalysisResult> {
  const started = Date.now();
  let checksCompleted = 0;
  const matches: ThreatMatch[] = [];
  const seenIds = new Set<string>();
  let bytesAnalyzed = 0;
  let externalScriptsFetched = 0;

  if (!input.html.trim()) {
    return {
      matches: [],
      scriptsAnalyzed: 0,
      externalScriptsFetched: 0,
      bytesAnalyzed: 0,
      checksCompleted: 0,
      checksTotal: CHECKS_TOTAL,
      durationMs: Date.now() - started,
    };
  }

  const pageHost = getHostname(input.finalUrl) ?? "";

  matches.push(...analyzeIframes(input.html, pageHost, input.finalUrl));
  matches.push(...analyzeForms(input.html, pageHost, input.finalUrl));
  matches.push(...analyzeEventHandlers(input.html, input.finalUrl));
  matches.push(...analyzeMetaRefreshRedirects(input.html, input.finalUrl));
  matches.push(...detectBase64ScriptBlocks(input.html, input.finalUrl));
  checksCompleted += 1;

  const scripts = extractScripts(input.html);
  checksCompleted += 1;

  for (const script of scripts) {
    if (isBudgetExceeded(input.budgetStartedAt)) break;
    if (bytesAnalyzed >= THREAT_LIMITS.maxTotalScriptBytes) break;

    if (script.kind === "inline") {
      bytesAnalyzed += script.content.length;
      matches.push(
        ...analyzeJavaScriptContent(script.content, `inline script #${script.index + 1}`, seenIds),
      );
      matches.push(...analyzeCryptoMinerCode(script.content, `inline script #${script.index + 1}`));
      matches.push(...analyzeSuspiciousCdnUrls(script.source, `inline script #${script.index + 1}`));
    } else {
      matches.push(...analyzeSuspiciousCdnUrls(script.source, script.source));
    }
  }

  checksCompleted += 1;

  const externalUrls = scripts
    .filter((script) => script.kind === "external")
    .map((script) => script.source);

  if (externalUrls.length > 0 && !isBudgetExceeded(input.budgetStartedAt)) {
    const remainingBudget = THREAT_LIMITS.maxTotalScriptBytes - bytesAnalyzed;
    const { scripts: fetched, bytesUsed } = await fetchExternalScripts(
      externalUrls,
      input.finalUrl,
      remainingBudget,
    );
    bytesAnalyzed += bytesUsed;
    externalScriptsFetched = fetched.length;

    for (const external of fetched) {
      if (isBudgetExceeded(input.budgetStartedAt)) break;
      matches.push(...analyzeSuspiciousCdnUrls(external.url, external.url));
      matches.push(...analyzeJavaScriptContent(external.content, external.url, seenIds));
      matches.push(...analyzeCryptoMinerCode(external.content, external.url));
    }
  }

  checksCompleted += 1;

  // Inline script tags referencing external URLs without fetch still count as analyzed surface.
  const scriptsAnalyzed =
    scripts.filter((s) => s.kind === "inline").length + externalScriptsFetched;
  checksCompleted += 1;

  const uniqueMatches = dedupeThreatMatches(matches);
  checksCompleted = CHECKS_TOTAL;

  return {
    matches: uniqueMatches,
    scriptsAnalyzed,
    externalScriptsFetched,
    bytesAnalyzed,
    checksCompleted,
    checksTotal: CHECKS_TOTAL,
    durationMs: Date.now() - started,
  };
}

function dedupeThreatMatches(matches: ThreatMatch[]): ThreatMatch[] {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = `${match.id}|${match.affectedResource}|${match.evidence.slice(0, 48)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
