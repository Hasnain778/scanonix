import type { PageAnalysisResult } from "@/lib/scan/website/types";

function countMatches(html: string, pattern: RegExp): number {
  return (html.match(pattern) ?? []).length;
}

function extractHostname(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

export function analyzePage(html: string, pageUrl: string): PageAnalysisResult {
  const pageHost = extractHostname(pageUrl);

  const scriptTags = html.match(/<script\b[^>]*>/gi) ?? [];
  const scriptCount = scriptTags.length;

  let externalScriptCount = 0;
  let inlineScriptCount = 0;

  for (const tag of scriptTags) {
    const srcMatch = tag.match(/\ssrc=["']([^"']+)["']/i);
    if (srcMatch?.[1]) {
      const srcHost = extractHostname(srcMatch[1]);
      if (srcHost && pageHost && srcHost !== pageHost) {
        externalScriptCount += 1;
      } else if (srcHost && pageHost && srcHost === pageHost) {
        inlineScriptCount += 0;
      } else if (/^https?:\/\//i.test(srcMatch[1])) {
        externalScriptCount += 1;
      }
    } else {
      inlineScriptCount += 1;
    }
  }

  const iframeCount = countMatches(html, /<iframe\b/gi);
  const formCount = countMatches(html, /<form\b/gi);
  const imageCount = countMatches(html, /<img\b/gi);
  const stylesheetCount = countMatches(html, /<link\b[^>]+rel=["']stylesheet["']/gi);

  const anchorMatches = html.match(/<a\b[^>]+href=["']([^"']+)["']/gi) ?? [];
  let externalLinkCount = 0;
  for (const anchor of anchorMatches) {
    const hrefMatch = anchor.match(/href=["']([^"']+)["']/i);
    const href = hrefMatch?.[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }
    const hrefHost = extractHostname(href);
    if (hrefHost && pageHost && hrefHost !== pageHost) {
      externalLinkCount += 1;
    } else if (/^https?:\/\//i.test(href) && hrefHost && pageHost && hrefHost !== pageHost) {
      externalLinkCount += 1;
    }
  }

  return {
    scriptCount,
    externalScriptCount,
    inlineScriptCount,
    iframeCount,
    formCount,
    externalLinkCount,
    imageCount,
    stylesheetCount,
  };
}
