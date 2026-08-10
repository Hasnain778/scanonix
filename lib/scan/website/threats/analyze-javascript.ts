import { THREAT_LIMITS } from "@/lib/scan/website/threats/constants";
import { truncateEvidence } from "@/lib/scan/website/threats/extract-html";
import type { ThreatMatch } from "@/lib/scan/website/threats/types";

interface PatternRule {
  id: string;
  title: string;
  pattern: RegExp;
  severity: ThreatMatch["severity"];
  whyItMatters: string;
  recommendation: string;
  confidence: ThreatMatch["confidence"];
  fixDifficulty?: ThreatMatch["fixDifficulty"];
}

const JAVASCRIPT_PATTERN_RULES: PatternRule[] = [
  {
    id: "eval-usage",
    title: "eval() detected in JavaScript",
    pattern: /\beval\s*\(/,
    severity: "high",
    whyItMatters: "eval executes arbitrary strings as code and is a common XSS and malware vector.",
    recommendation: "Remove eval() and use safe parsing alternatives such as JSON.parse for data.",
    confidence: "high",
    fixDifficulty: "hard",
  },
  {
    id: "new-function",
    title: "Dynamic code execution via new Function()",
    pattern: /new\s+Function\s*\(/,
    severity: "high",
    whyItMatters: "new Function() compiles strings into executable code, similar to eval.",
    recommendation: "Avoid dynamic Function constructors; refactor to static, reviewable code.",
    confidence: "high",
    fixDifficulty: "hard",
  },
  {
    id: "document-write",
    title: "document.write() usage detected",
    pattern: /document\.write\s*\(/,
    severity: "medium",
    whyItMatters: "document.write can inject untrusted markup and break page integrity.",
    recommendation: "Use DOM APIs (createElement, appendChild) instead of document.write.",
    confidence: "high",
    fixDifficulty: "moderate",
  },
  {
    id: "innerhtml-assignment",
    title: "innerHTML assignment detected",
    pattern: /\.innerHTML\s*=/,
    severity: "medium",
    whyItMatters: "Assigning innerHTML with untrusted data can lead to DOM-based XSS.",
    recommendation: "Use textContent for text or sanitize HTML before assigning to innerHTML.",
    confidence: "high",
    fixDifficulty: "moderate",
  },
  {
    id: "settimeout-string",
    title: "setTimeout() called with string argument",
    pattern: /setTimeout\s*\(\s*(['"`][^'"`]+['"`]|\+)/,
    severity: "high",
    whyItMatters: "String-based setTimeout behaves like eval and executes arbitrary code.",
    recommendation: "Pass a function reference to setTimeout instead of a string.",
    confidence: "medium",
    fixDifficulty: "moderate",
  },
  {
    id: "setinterval-string",
    title: "setInterval() called with string argument",
    pattern: /setInterval\s*\(\s*(['"`][^'"`]+['"`]|\+)/,
    severity: "high",
    whyItMatters: "String-based setInterval executes code dynamically and is difficult to audit.",
    recommendation: "Pass a function reference to setInterval instead of a string.",
    confidence: "medium",
    fixDifficulty: "moderate",
  },
  {
    id: "location-manipulation",
    title: "Window location manipulation detected",
    pattern: /(?:window\.|document\.|top\.)?location(?:\.href|\.replace|\.assign)?\s*=/,
    severity: "medium",
    whyItMatters: "Client-side redirects can be abused for phishing and open redirect attacks.",
    recommendation: "Validate redirect targets against an allowlist before changing location.",
    confidence: "medium",
    fixDifficulty: "moderate",
  },
  {
    id: "base64-atob-block",
    title: "Base64 decoding with atob() detected",
    pattern: /atob\s*\(\s*['"`][A-Za-z0-9+/=]{40,}/,
    severity: "medium",
    whyItMatters: "Large base64 blobs decoded at runtime may hide malicious payloads.",
    recommendation: "Inspect decoded content and remove unnecessary obfuscated script blocks.",
    confidence: "medium",
    fixDifficulty: "moderate",
  },
];

function detectObfuscation(content: string): { score: number; reason: string } | null {
  if (content.length < 120) return null;

  const nonAlphaNumeric = (content.match(/[^a-zA-Z0-9\s]/g) ?? []).length;
  const ratio = nonAlphaNumeric / content.length;
  const charCodeChains = (content.match(/String\.fromCharCode/gi) ?? []).length;
  const hexEscapes = (content.match(/\\x[0-9a-f]{2}/gi) ?? []).length;
  const longTokens = (content.match(/[^\s]{180,}/g) ?? []).length;

  if (charCodeChains >= 3 || hexEscapes >= 8) {
    return {
      score: 0.8,
      reason: `Obfuscation indicators: String.fromCharCode×${charCodeChains}, hex escapes×${hexEscapes}.`,
    };
  }

  if (ratio > 0.35 && content.length > 300) {
    return {
      score: ratio,
      reason: `High non-alphanumeric ratio (${Math.round(ratio * 100)}%) in script content.`,
    };
  }

  if (longTokens >= 2) {
    return {
      score: 0.6,
      reason: " unusually long encoded tokens present in script content.",
    };
  }

  return null;
}

export function analyzeJavaScriptContent(
  content: string,
  affectedResource: string,
  existingIds: Set<string>,
): ThreatMatch[] {
  const matches: ThreatMatch[] = [];

  for (const rule of JAVASCRIPT_PATTERN_RULES) {
    if (!rule.pattern.test(content)) continue;
    if (existingIds.has(`${affectedResource}:${rule.id}`)) continue;
    if (matches.filter((m) => m.id === rule.id).length >= THREAT_LIMITS.maxMatchesPerCategory) {
      continue;
    }

    const evidenceMatch = content.match(rule.pattern);
    const evidenceStart = evidenceMatch?.index ?? 0;
    const snippet = truncateEvidence(content.slice(Math.max(0, evidenceStart), evidenceStart + 120));

    matches.push({
      id: rule.id,
      category: "dangerous-api",
      severity: rule.severity,
      title: rule.title,
      description: `${rule.title} found in ${affectedResource}.`,
      whyItMatters: rule.whyItMatters,
      evidence: snippet,
      recommendation: rule.recommendation,
      confidence: rule.confidence,
      affectedResource,
      fixDifficulty: rule.fixDifficulty,
    });
    existingIds.add(`${affectedResource}:${rule.id}`);
  }

  const obfuscation = detectObfuscation(content);
  if (obfuscation && !existingIds.has(`${affectedResource}:obfuscated-js`)) {
    matches.push({
      id: "obfuscated-js",
      category: "obfuscation",
      severity: obfuscation.score > 0.7 ? "high" : "medium",
      title: "Obfuscated JavaScript detected",
      description: `Script at ${affectedResource} shows signs of obfuscation.`,
      whyItMatters: "Obfuscated code hides intent and is commonly used by skimmers, miners, and malware.",
      evidence: truncateEvidence(obfuscation.reason),
      recommendation: "Review the script source, remove obfuscation, and prefer readable vendor bundles.",
      confidence: obfuscation.score > 0.7 ? "high" : "medium",
      affectedResource,
      fixDifficulty: "hard",
    });
    existingIds.add(`${affectedResource}:obfuscated-js`);
  }

  return matches;
}

export function detectBase64ScriptBlocks(html: string, affectedResource: string): ThreatMatch[] {
  const matches: ThreatMatch[] = [];
  const dataUriPattern = /<script\b[^>]+src=["']data:text\/javascript;base64,([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while (
    (match = dataUriPattern.exec(html)) !== null &&
    matches.length < THREAT_LIMITS.maxMatchesPerCategory
  ) {
    const payload = match[1] ?? "";
    matches.push({
      id: "base64-script-src",
      category: "base64-script",
      severity: "high",
      title: "Base64-encoded script source detected",
      description: "A script tag loads JavaScript from a base64 data URI.",
      whyItMatters: "Base64 script sources conceal code from static review and are rare in legitimate sites.",
      evidence: truncateEvidence(`data:text/javascript;base64,${payload.slice(0, 80)}…`),
      recommendation: "Replace data-URI scripts with hosted, reviewable JavaScript files.",
      confidence: "high",
      affectedResource,
      fixDifficulty: "moderate",
    });
  }

  return matches;
}
