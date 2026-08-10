import { THREAT_LIMITS } from "@/lib/scan/website/threats/constants";
import type { ExtractedForm, ExtractedIframe, ExtractedScript } from "@/lib/scan/website/threats/types";

export function truncateEvidence(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= THREAT_LIMITS.maxEvidenceLength) {
    return normalized;
  }
  return `${normalized.slice(0, THREAT_LIMITS.maxEvidenceLength)}…`;
}

export function extractScripts(html: string): ExtractedScript[] {
  const scripts: ExtractedScript[] = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(html)) !== null && scripts.length < THREAT_LIMITS.maxInlineScripts) {
    const attrs = match[1] ?? "";
    const body = match[2] ?? "";
    const srcMatch = attrs.match(/\ssrc=["']([^"']+)["']/i);
    const src = srcMatch?.[1]?.trim();

    if (src) {
      scripts.push({
        kind: "external",
        source: src,
        content: "",
        index,
      });
    } else if (body.trim()) {
      scripts.push({
        kind: "inline",
        source: "inline",
        content: body.slice(0, THREAT_LIMITS.maxScriptBytes),
        index,
      });
    }
    index += 1;
  }

  return scripts;
}

export function extractIframes(html: string): ExtractedIframe[] {
  const iframes: ExtractedIframe[] = [];
  const pattern = /<iframe\b([^>]*)(?:\/>|>[\s\S]*?<\/iframe>)/gi;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(html)) !== null && iframes.length < THREAT_LIMITS.maxIframes) {
    const attrs = match[1] ?? "";
    const srcMatch = attrs.match(/\ssrc=["']([^"']*)["']/i);
    iframes.push({
      src: srcMatch?.[1]?.trim() ?? null,
      attributes: attrs,
      index,
    });
    index += 1;
  }

  return iframes;
}

export function extractForms(html: string): ExtractedForm[] {
  const forms: ExtractedForm[] = [];
  const pattern = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(html)) !== null && forms.length < THREAT_LIMITS.maxForms) {
    const attrs = match[1] ?? "";
    const inner = match[2] ?? "";
    const actionMatch = attrs.match(/\saction=["']([^"']*)["']/i);
    const snippet = `<form ${attrs}>${inner.slice(0, 400)}</form>`;
    const hidden =
      /\bhidden\b/i.test(attrs) ||
      /display\s*:\s*none/i.test(attrs) ||
      /visibility\s*:\s*hidden/i.test(attrs) ||
      /opacity\s*:\s*0/i.test(attrs) ||
      /position\s*:\s*absolute[^;]*left\s*:\s*-\d/i.test(attrs);
    const hasPasswordField = /<input\b[^>]*type=["']password["']/i.test(inner);

    forms.push({
      action: actionMatch?.[1]?.trim() ?? null,
      html: snippet,
      index,
      hidden,
      hasPasswordField,
    });
    index += 1;
  }

  return forms;
}

export function extractDangerousEventHandlers(html: string): { handler: string; snippet: string }[] {
  const results: { handler: string; snippet: string }[] = [];
  const pattern = /\s(on[a-z]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match: RegExpExecArray | null;

  while (
    (match = pattern.exec(html)) !== null &&
    results.length < THREAT_LIMITS.maxMatchesPerCategory
  ) {
    const handler = match[1] ?? "on*";
    const value = (match[3] ?? match[4] ?? match[5] ?? "").trim();
    if (!value) continue;
    results.push({
      handler,
      snippet: truncateEvidence(`${handler}=${value}`),
    });
  }

  return results;
}

export function extractMetaRefreshRedirects(html: string): string[] {
  const redirects: string[] = [];
  const pattern =
    /<meta\b[^>]+http-equiv=["']refresh["'][^>]+content=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while (
    (match = pattern.exec(html)) !== null &&
    redirects.length < THREAT_LIMITS.maxMatchesPerCategory
  ) {
    redirects.push(match[1]?.trim() ?? "");
  }

  return redirects;
}

export function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isExternalResource(resourceUrl: string, pageHost: string): boolean {
  if (!/^https?:\/\//i.test(resourceUrl)) return false;
  const host = getHostname(resourceUrl);
  return Boolean(host && host !== pageHost);
}
