import type { TechnologyMatch } from "@/lib/scan/website/types";

interface TechnologyRule {
  name: string;
  confidence: TechnologyMatch["confidence"];
  headerChecks?: { key: string; includes?: string; equals?: string }[];
  htmlChecks?: RegExp[];
}

const TECHNOLOGY_RULES: TechnologyRule[] = [
  {
    name: "Cloudflare",
    confidence: "high",
    headerChecks: [{ key: "server", includes: "cloudflare" }, { key: "cf-ray" }],
  },
  {
    name: "Vercel",
    confidence: "high",
    headerChecks: [{ key: "server", includes: "vercel" }, { key: "x-vercel-id" }],
  },
  {
    name: "Netlify",
    confidence: "high",
    headerChecks: [{ key: "server", includes: "netlify" }, { key: "x-nf-request-id" }],
  },
  {
    name: "WordPress",
    confidence: "high",
    htmlChecks: [/wp-content\//i, /wp-includes\//i, /name=["']generator["'][^>]+wordpress/i],
  },
  {
    name: "Shopify",
    confidence: "high",
    htmlChecks: [/cdn\.shopify\.com/i, /Shopify\.theme/i],
    headerChecks: [{ key: "x-shopid" }],
  },
  {
    name: "Next.js",
    confidence: "high",
    htmlChecks: [/__NEXT_DATA__/i, /\/_next\/static\//i],
    headerChecks: [{ key: "x-powered-by", includes: "next" }],
  },
  {
    name: "React",
    confidence: "medium",
    htmlChecks: [/data-reactroot/i, /react(?:\.production|\.development)?\.min\.js/i],
  },
  {
    name: "Vue",
    confidence: "medium",
    htmlChecks: [/vue(?:\.runtime)?(?:\.global|\.esm)?\.js/i, /__VUE__/i],
  },
  {
    name: "Angular",
    confidence: "medium",
    htmlChecks: [/ng-version=/i, /angular(?:\.min)?\.js/i],
  },
  {
    name: "Laravel",
    confidence: "medium",
    headerChecks: [{ key: "set-cookie", includes: "laravel_session" }],
    htmlChecks: [/laravel_session/i],
  },
  {
    name: "ASP.NET",
    confidence: "medium",
    headerChecks: [{ key: "x-aspnet-version" }, { key: "x-powered-by", includes: "asp.net" }],
    htmlChecks: [/__VIEWSTATE/i],
  },
];

function headerMatches(
  headers: Record<string, string>,
  check: NonNullable<TechnologyRule["headerChecks"]>[number],
): boolean {
  const value = headers[check.key.toLowerCase()];
  if (!value) return false;
  if (check.equals && value.toLowerCase() === check.equals.toLowerCase()) return true;
  if (check.includes && value.toLowerCase().includes(check.includes.toLowerCase())) return true;
  if (!check.equals && !check.includes) return true;
  return false;
}

export function detectTechnologies(
  headers: Record<string, string>,
  html: string,
  rawHeaderLines: string[] = [],
): TechnologyMatch[] {
  const headerBlob = rawHeaderLines.join("\n").toLowerCase();
  const matches: TechnologyMatch[] = [];

  for (const rule of TECHNOLOGY_RULES) {
    const evidence: string[] = [];

    for (const check of rule.headerChecks ?? []) {
      if (headerMatches(headers, check)) {
        evidence.push(`Header ${check.key}`);
      } else if (check.key === "set-cookie" && check.includes && headerBlob.includes(check.includes.toLowerCase())) {
        evidence.push(`Cookie pattern ${check.includes}`);
      }
    }

    for (const pattern of rule.htmlChecks ?? []) {
      if (pattern.test(html)) {
        evidence.push(`HTML pattern ${pattern.source}`);
      }
    }

    if (evidence.length > 0) {
      matches.push({
        name: rule.name,
        confidence: rule.confidence,
        evidence: [...new Set(evidence)].slice(0, 4),
      });
    }
  }

  return matches;
}
