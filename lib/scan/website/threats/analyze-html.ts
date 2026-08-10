import {
  CRYPTO_MINER_CODE_PATTERNS,
  SUSPICIOUS_CDN_PATTERNS,
  THREAT_LIMITS,
} from "@/lib/scan/website/threats/constants";
import {
  extractDangerousEventHandlers,
  extractForms,
  extractIframes,
  extractMetaRefreshRedirects,
  isExternalResource,
  truncateEvidence,
} from "@/lib/scan/website/threats/extract-html";
import type { ThreatMatch } from "@/lib/scan/website/threats/types";

export function analyzeIframes(
  html: string,
  pageHost: string,
  finalUrl: string,
): ThreatMatch[] {
  const matches: ThreatMatch[] = [];
  const iframes = extractIframes(html);

  for (const iframe of iframes) {
    const attrs = iframe.attributes.toLowerCase();
    const hidden =
      /\bhidden\b/.test(attrs) ||
      /display\s*:\s*none/.test(attrs) ||
      /width=["']0/.test(attrs) ||
      /height=["']0/.test(attrs) ||
      /opacity\s*:\s*0/.test(attrs);

    if (iframe.src && isExternalResource(iframe.src, pageHost) && hidden) {
      matches.push({
        id: `suspicious-iframe-${iframe.index}`,
        category: "iframe",
        severity: "high",
        title: "Hidden external iframe detected",
        description: `Iframe #${iframe.index + 1} loads external content while hidden from view.`,
        whyItMatters: "Hidden third-party iframes are used for clickjacking, skimming, and drive-by attacks.",
        evidence: truncateEvidence(`src=${iframe.src}; attrs=${iframe.attributes.slice(0, 120)}`),
        recommendation: "Remove unnecessary hidden iframes and audit third-party embed sources.",
        confidence: "high",
        affectedResource: iframe.src,
        fixDifficulty: "moderate",
      });
    } else if (iframe.src && isExternalResource(iframe.src, pageHost)) {
      matches.push({
        id: `external-iframe-${iframe.index}`,
        category: "iframe",
        severity: "low",
        title: "External iframe embed detected",
        description: `Iframe #${iframe.index + 1} loads content from a third-party domain.`,
        whyItMatters: "Third-party iframes expand the attack surface and may leak user context.",
        evidence: truncateEvidence(iframe.src),
        recommendation: "Verify the iframe source is trusted and apply sandbox attributes where possible.",
        confidence: "medium",
        affectedResource: iframe.src,
        fixDifficulty: "easy",
      });
    }
  }

  void finalUrl;
  return matches.slice(0, THREAT_LIMITS.maxMatchesPerCategory);
}

export function analyzeForms(html: string, pageHost: string, finalUrl: string): ThreatMatch[] {
  const matches: ThreatMatch[] = [];
  const forms = extractForms(html);

  for (const form of forms) {
    if (form.hidden && form.hasPasswordField) {
      matches.push({
        id: `hidden-password-form-${form.index}`,
        category: "form",
        severity: "critical",
        title: "Hidden password form detected",
        description: `Form #${form.index + 1} contains a password field but is hidden from users.`,
        whyItMatters: "Hidden credential forms are a strong indicator of password harvesting or skimming.",
        evidence: truncateEvidence(form.html),
        recommendation: "Remove hidden credential forms and inspect the site for compromise or malicious injection.",
        confidence: "high",
        affectedResource: form.action ?? finalUrl,
        fixDifficulty: "hard",
      });
    }

    if (form.hasPasswordField && form.action) {
      const actionHost = (() => {
        try {
          return new URL(form.action, finalUrl).hostname.toLowerCase();
        } catch {
          return null;
        }
      })();

      if (actionHost && actionHost !== pageHost) {
        matches.push({
          id: `external-password-form-${form.index}`,
          category: "form",
          severity: "high",
          title: "Password form submits to external domain",
          description: `Form #${form.index + 1} sends credentials to ${actionHost}.`,
          whyItMatters: "Credential submission to unrelated domains may indicate phishing or skimmer activity.",
          evidence: truncateEvidence(`action=${form.action}`),
          recommendation: "Ensure login forms submit only to trusted first-party authentication endpoints.",
          confidence: "high",
          affectedResource: form.action,
          fixDifficulty: "moderate",
        });
      }
    }
  }

  return matches.slice(0, THREAT_LIMITS.maxMatchesPerCategory);
}

export function analyzeEventHandlers(html: string, finalUrl: string): ThreatMatch[] {
  const handlers = extractDangerousEventHandlers(html);
  const dangerous = handlers.filter((entry) =>
    /javascript:|eval\(|document\.cookie|location\.|window\.open/i.test(entry.snippet),
  );

  return dangerous.slice(0, THREAT_LIMITS.maxMatchesPerCategory).map((entry, index) => ({
    id: `dangerous-event-handler-${index}`,
    category: "event-handler" as const,
    severity: "medium" as const,
    title: "Dangerous inline event handler detected",
    description: `An inline ${entry.handler} handler contains potentially unsafe JavaScript.`,
    whyItMatters: "Inline event handlers bypass CSP protections and are difficult to audit.",
    evidence: entry.snippet,
    recommendation: "Move handlers to external script files and enforce a strict Content-Security-Policy.",
    confidence: "medium" as const,
    affectedResource: finalUrl,
    fixDifficulty: "moderate" as const,
  }));
}

export function analyzeMetaRefreshRedirects(html: string, finalUrl: string): ThreatMatch[] {
  const redirects = extractMetaRefreshRedirects(html);
  return redirects.map((content, index) => ({
    id: `meta-refresh-${index}`,
    category: "redirect" as const,
    severity: "medium" as const,
    title: "Meta refresh redirect detected",
    description: "The page uses a meta refresh tag to redirect users.",
    whyItMatters: "Meta refresh redirects can be abused for phishing and unauthorized navigation.",
    evidence: truncateEvidence(content),
    recommendation: "Use HTTP 3xx redirects or explicit user-initiated navigation instead.",
    confidence: "high" as const,
    affectedResource: finalUrl,
    fixDifficulty: "easy" as const,
  }));
}

export function analyzeSuspiciousCdnUrls(url: string, affectedResource: string): ThreatMatch[] {
  const lower = url.toLowerCase();
  const matches: ThreatMatch[] = [];

  for (const entry of SUSPICIOUS_CDN_PATTERNS) {
    if (!lower.includes(entry.pattern)) continue;
    matches.push({
      id: `malicious-cdn-${entry.pattern.replace(/\W+/g, "-")}`,
      category: "malicious-cdn",
      severity: "critical",
      title: "Known malicious CDN pattern detected",
      description: `Resource URL matches a known malicious pattern: ${entry.label}.`,
      whyItMatters: "This host or pattern has been associated with browser-based cryptomining malware.",
      evidence: truncateEvidence(url),
      recommendation: "Remove the resource immediately and investigate how it was injected.",
      confidence: "high",
      affectedResource,
      fixDifficulty: "easy",
    });
    break;
  }

  return matches;
}

export function analyzeCryptoMinerCode(content: string, affectedResource: string): ThreatMatch[] {
  for (const pattern of CRYPTO_MINER_CODE_PATTERNS) {
    if (pattern.test(content)) {
      return [
        {
          id: "crypto-miner-code",
          category: "crypto-miner",
          severity: "critical",
          title: "Cryptocurrency miner indicator detected",
          description: "Script content matches known in-browser mining patterns.",
          whyItMatters: "Cryptomining scripts consume visitor CPU without consent and indicate compromise.",
          evidence: truncateEvidence(content.match(pattern)?.[0] ?? pattern.source),
          recommendation: "Remove miner scripts, rotate credentials, and inspect server-side integrity.",
          confidence: "high",
          affectedResource,
          fixDifficulty: "hard",
        },
      ];
    }
  }
  return [];
}
