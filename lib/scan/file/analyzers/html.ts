import { FILE_LIMITS } from "@/lib/scan/file/constants";
import { truncateEvidence } from "@/lib/scan/file/metadata";
import type { FileAnalysisContext, FileAnalysisMatch } from "@/lib/scan/file/types";

export function analyzeHtmlFile(context: FileAnalysisContext): FileAnalysisMatch[] {
  const matches: FileAnalysisMatch[] = [];
  const html = context.textPreview;
  const fileName = context.metadata.fileName;

  if (/<iframe[^>]+(?:hidden|display\s*:\s*none|width=["']0|height=["']0)/i.test(html)) {
    matches.push({
      id: "html-hidden-iframe",
      category: "html",
      severity: "high",
      title: "Hidden iframe in HTML file",
      description: "HTML contains a hidden or zero-size iframe.",
      whyItMatters: "Hidden iframes are used for clickjacking and credential theft.",
      evidence: truncateEvidence(html.match(/<iframe[^>]+>/i)?.[0] ?? "hidden iframe"),
      recommendation: "Remove hidden iframes and audit external embed sources.",
      confidence: "high",
      affectedResource: fileName,
      fixDifficulty: "moderate",
    });
  }

  if (/<form[^>]*>[\s\S]*?type=["']password["']/i.test(html)) {
    const hiddenForm = /<form[^>]*(?:hidden|display\s*:\s*none)[^>]*>[\s\S]*?password/i.test(html);
    matches.push({
      id: hiddenForm ? "html-hidden-password-form" : "html-password-form",
      category: "html",
      severity: hiddenForm ? "critical" : "medium",
      title: hiddenForm ? "Hidden password form in HTML" : "Password form in HTML file",
      description: hiddenForm
        ? "A password field exists inside a hidden form."
        : "HTML file contains a password input field.",
      whyItMatters: hiddenForm
        ? "Hidden credential forms indicate phishing or harvesting."
        : "Standalone HTML with password fields may capture credentials offline.",
      evidence: truncateEvidence(html.match(/<form[^>]*>[\s\S]{0,200}/i)?.[0] ?? "password form"),
      recommendation: "Do not submit credentials unless the file source is trusted.",
      confidence: "high",
      affectedResource: fileName,
      fixDifficulty: hiddenForm ? "hard" : "moderate",
    });
  }

  if (/<script[^>]+src=["']https?:\/\//i.test(html)) {
    matches.push({
      id: "html-external-script",
      category: "html",
      severity: "low",
      title: "External script reference in HTML",
      description: "HTML loads JavaScript from a third-party URL.",
      whyItMatters: "External scripts expand trust boundary and supply-chain risk.",
      evidence: truncateEvidence(html.match(/<script[^>]+src=["'][^"']+["']/i)?.[0] ?? ""),
      recommendation: "Verify third-party script sources and use Subresource Integrity where possible.",
      confidence: "high",
      affectedResource: fileName,
      fixDifficulty: "moderate",
    });
  }

  if (/on(?:click|error|load|mouseover)\s*=/i.test(html)) {
    matches.push({
      id: "html-inline-event-handler",
      category: "html",
      severity: "medium",
      title: "Dangerous inline event handler",
      description: "HTML uses inline event handler attributes.",
      whyItMatters: "Inline handlers execute JavaScript and increase XSS risk.",
      evidence: truncateEvidence(html.match(/on\w+\s*=\s*["'][^"']{0,80}/i)?.[0] ?? ""),
      recommendation: "Move handlers to external scripts with strict CSP.",
      confidence: "high",
      affectedResource: fileName,
      fixDifficulty: "moderate",
    });
  }

  if (/<script[^>]*>[\s\S]*?(eval|document\.write|atob)/i.test(html)) {
    matches.push({
      id: "html-dangerous-inline-js",
      category: "html",
      severity: "high",
      title: "Dangerous inline JavaScript in HTML",
      description: "Inline script block contains eval, document.write, or atob.",
      whyItMatters: "Dangerous APIs in inline scripts are common in malicious HTML pages.",
      evidence: "inline script with eval/document.write/atob",
      recommendation: "Remove inline scripts and audit all embedded JavaScript.",
      confidence: "high",
      affectedResource: fileName,
      fixDifficulty: "hard",
    });
  }

  return matches.slice(0, FILE_LIMITS.maxMatchesPerCategory);
}
