import type { RedirectAnalysis, RedirectHop } from "@/lib/scan/website/types";
import { SCAN_LIMITS } from "@/lib/scan/website/constants";

function isHttpUrl(url: string): boolean {
  return url.toLowerCase().startsWith("http://");
}

function isHttpsUrl(url: string): boolean {
  return url.toLowerCase().startsWith("https://");
}

function normalizeForCompare(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.replace(/\/$/, "");
  }
}

export function analyzeRedirects(
  inputUrl: string,
  finalUrl: string,
  chain: RedirectHop[],
): RedirectAnalysis {
  const notes: string[] = [];
  const httpToHttps =
    isHttpUrl(inputUrl) &&
    chain.some((hop, index) => {
      const next = chain[index + 1];
      return isHttpUrl(hop.url) && next ? isHttpsUrl(next.url) : false;
    });

  const seen = new Set<string>();
  let redirectLoop = false;
  for (const hop of chain) {
    const key = normalizeForCompare(hop.url);
    if (seen.has(key)) {
      redirectLoop = true;
      notes.push("Redirect loop detected in the response chain.");
      break;
    }
    seen.add(key);
  }

  const excessiveRedirects = chain.length > SCAN_LIMITS.maxRedirects;
  if (excessiveRedirects) {
    notes.push(`More than ${SCAN_LIMITS.maxRedirects} redirects were observed.`);
  }

  let suspiciousChain = false;
  for (let index = 1; index < chain.length; index += 1) {
    const previous = chain[index - 1];
    const current = chain[index];
    if (!previous || !current) continue;

    try {
      const prevHost = new URL(previous.url).hostname;
      const currHost = new URL(current.url).hostname;
      if (prevHost !== currHost) {
        suspiciousChain = true;
        notes.push(`Cross-domain redirect: ${prevHost} → ${currHost}.`);
      }
    } catch {
      suspiciousChain = true;
    }
  }

  if (isHttpUrl(finalUrl)) {
    notes.push("Final URL is still served over HTTP.");
  }

  return {
    httpToHttps,
    redirectLoop,
    excessiveRedirects,
    suspiciousChain,
    notes,
  };
}
