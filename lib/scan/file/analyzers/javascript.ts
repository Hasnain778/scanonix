import { FILE_LIMITS } from "@/lib/scan/file/constants";
import { truncateEvidence } from "@/lib/scan/file/metadata";
import type { FileAnalysisContext, FileAnalysisMatch } from "@/lib/scan/file/types";

const JS_PATTERNS: {
  id: string;
  title: string;
  pattern: RegExp;
  severity: FileAnalysisMatch["severity"];
  why: string;
  rec: string;
}[] = [
  { id: "js-eval", title: "eval() in JavaScript file", pattern: /\beval\s*\(/, severity: "high", why: "eval executes arbitrary strings as code.", rec: "Remove eval and use safe parsing alternatives." },
  { id: "js-new-function", title: "Function constructor in JavaScript", pattern: /new\s+Function\s*\(/, severity: "high", why: "Dynamic Function creation behaves like eval.", rec: "Refactor to static, reviewable code." },
  { id: "js-atob", title: "atob() base64 decoding", pattern: /\batob\s*\(/, severity: "medium", why: "Base64 decoding often hides obfuscated payloads.", rec: "Inspect decoded content before trusting." },
  { id: "js-document-write", title: "document.write() usage", pattern: /document\.write\s*\(/, severity: "medium", why: "document.write can inject untrusted markup.", rec: "Use safe DOM APIs instead." },
  { id: "js-location", title: "Suspicious redirect", pattern: /(?:location|window\.location)\.(?:href|assign|replace)/, severity: "medium", why: "Redirects may send users to phishing pages.", rec: "Verify redirect destinations." },
  { id: "js-credential", title: "Credential harvesting indicator", pattern: /password|login|credential|token|api[_-]?key/i, severity: "low", why: "Scripts referencing credentials may exfiltrate secrets.", rec: "Audit network calls and storage access." },
];

function obfuscationScore(content: string): number {
  const len = content.length;
  if (len < 80) return 0;
  const specials = (content.match(/\\x|\\u|%[0-9a-f]{2}|[^\w\s]/g) ?? []).length;
  return specials / len;
}

export function analyzeJavaScriptFile(context: FileAnalysisContext): FileAnalysisMatch[] {
  const matches: FileAnalysisMatch[] = [];
  const content = context.textPreview;

  for (const rule of JS_PATTERNS) {
    if (!rule.pattern.test(content)) continue;
    matches.push({
      id: rule.id,
      category: "javascript",
      severity: rule.severity,
      title: rule.title,
      description: `${rule.title} detected in ${context.metadata.fileName}.`,
      whyItMatters: rule.why,
      evidence: truncateEvidence(content.match(rule.pattern)?.[0] ?? rule.title),
      recommendation: rule.rec,
      confidence: "high",
      affectedResource: context.metadata.fileName,
      fixDifficulty: "moderate",
    });
  }

  if (obfuscationScore(content) > 0.25) {
    matches.push({
      id: "js-obfuscation",
      category: "javascript",
      severity: "high",
      title: "Obfuscated JavaScript detected",
      description: "High density of escaped or non-alphanumeric characters suggests obfuscation.",
      whyItMatters: "Obfuscation hides malicious logic from casual inspection.",
      evidence: truncateEvidence(content.slice(0, 120)),
      recommendation: "Deobfuscate in a sandbox before execution.",
      confidence: "medium",
      affectedResource: context.metadata.fileName,
      fixDifficulty: "hard",
    });
  }

  if (/[A-Za-z0-9+/]{80,}={0,2}/.test(content) && /\batob|eval|Function/i.test(content)) {
    matches.push({
      id: "js-base64-payload",
      category: "javascript",
      severity: "high",
      title: "Base64 encoded payload with execution",
      description: "Large base64 block combined with dynamic execution patterns.",
      whyItMatters: "Encoded payloads are commonly used to hide malware stages.",
      evidence: "Base64 + eval/Function/atob pattern",
      recommendation: "Decode and inspect payload in an isolated environment.",
      confidence: "medium",
      affectedResource: context.metadata.fileName,
      fixDifficulty: "hard",
    });
  }

  return matches.slice(0, FILE_LIMITS.maxMatchesPerCategory);
}

export function analyzeCssFile(context: FileAnalysisContext): FileAnalysisMatch[] {
  const matches: FileAnalysisMatch[] = [];
  if (/expression\s*\(|javascript:/i.test(context.textPreview)) {
    matches.push({
      id: "css-dangerous-expression",
      category: "javascript",
      severity: "medium",
      title: "Dangerous CSS expression or javascript: URL",
      description: "CSS contains legacy expression or javascript: protocol usage.",
      whyItMatters: "Some browsers execute script via CSS in legacy contexts.",
      evidence: truncateEvidence(context.textPreview.match(/expression\s*\(|javascript:/i)?.[0] ?? ""),
      recommendation: "Remove dynamic CSS expressions and external javascript: URLs.",
      confidence: "medium",
      affectedResource: context.metadata.fileName,
      fixDifficulty: "moderate",
    });
  }
  return matches;
}
