import type { ScanReport, ScanReportFinding } from "@/lib/scan-report/types";

const BASE_TIMELINE = [
  { id: "upload", label: "Upload", completed: true },
  { id: "extract", label: "Extract", completed: true },
  { id: "static", label: "Static Analysis", completed: true },
  { id: "malware", label: "Malware Detection", completed: true },
  { id: "ai", label: "AI Analysis", completed: true },
  { id: "report", label: "Report Generated", completed: true },
] as const;

function demoFindingAi(
  finding: Pick<ScanReportFinding, "description" | "whyItMatters" | "recommendation" | "fixDifficulty">,
  params: {
    whatHappened: string;
    whyDangerous: string;
    howToFix: string;
    estimatedRiskReduction: number;
    priority: "critical" | "high" | "medium" | "low";
    businessImpact?: string;
    technicalImpact?: string;
  },
): NonNullable<ScanReportFinding["ai"]> {
  return {
    plainEnglishExplanation: finding.description,
    whyItMatters: finding.whyItMatters,
    businessImpact:
      params.businessImpact ??
      "Unresolved issues in this area can increase operational and reputational risk for the business.",
    technicalImpact:
      params.technicalImpact ?? `${finding.description} ${finding.whyItMatters}`,
    remediationSteps: [params.howToFix],
    estimatedDifficulty: finding.fixDifficulty,
    estimatedRiskReduction: params.estimatedRiskReduction,
    confidenceExplanation:
      "Demo analysis based on representative scanner findings for UI preview purposes.",
    priority: params.priority,
    whatHappened: params.whatHappened,
    whyDangerous: params.whyDangerous,
    howToFix: params.howToFix,
    source: "ai",
  };
}

export const DEMO_SCAN_REPORT: ScanReport = {
  id: "demo",
  target: "https://acme-store.example/checkout",
  targetType: "website",
  completedAt: new Date().toISOString(),
  durationMs: 8420,
  riskScore: 68,
  summary: {
    criticalIssues: 0,
    warnings: 4,
    passedChecks: 24,
    aiConfidence: 92,
  },
  findings: [
    {
      id: "xss-reflected",
      severity: "high",
      title: "Cross Site Scripting (Reflected XSS)",
      description:
        "User-supplied input in the search parameter is reflected in the HTML response without encoding.",
      affectedFile: "/checkout/search?q=<payload>",
      whyItMatters:
        "Attackers can execute malicious scripts in a victim's browser, steal session cookies, or perform actions on their behalf.",
      recommendation:
        "Sanitize all user input using DOMPurify and enable a strict Content Security Policy (CSP).",
      fixDifficulty: "moderate",
      references: [
        {
          label: "OWASP XSS Prevention",
          url: "https://owasp.org/www-community/attacks/xss/",
        },
        {
          label: "MDN CSP Guide",
          url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP",
        },
      ],
      ai: demoFindingAi(
        {
          description:
            "User-supplied input in the search parameter is reflected in the HTML response without encoding.",
          whyItMatters:
            "Attackers can execute malicious scripts in a victim's browser, steal session cookies, or perform actions on their behalf.",
          recommendation:
            "Sanitize all user input using DOMPurify and enable a strict Content Security Policy (CSP).",
          fixDifficulty: "moderate",
        },
        {
          whatHappened:
            "The application echoes the q query parameter directly into a div element on the search results page.",
          whyDangerous:
            "An attacker can craft a URL that executes JavaScript in the context of your domain, compromising authenticated users.",
          howToFix:
            "Sanitize all user input using DOMPurify and enable CSP with script-src restrictions. Encode output at the template layer.",
          estimatedRiskReduction: 24,
          priority: "high",
        },
      ),
    },
    {
      id: "missing-hsts",
      severity: "medium",
      title: "Missing Strict-Transport-Security Header",
      description:
        "The response does not include an HSTS header, allowing potential downgrade attacks on first visit.",
      affectedFile: "HTTP response headers",
      whyItMatters:
        "Without HSTS, users may connect over HTTP before redirect, exposing credentials to network attackers.",
      recommendation:
        "Add Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
      fixDifficulty: "easy",
      references: [
        {
          label: "OWASP HSTS Cheat Sheet",
          url: "https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html",
        },
      ],
      ai: demoFindingAi(
        {
          description:
            "The response does not include an HSTS header, allowing potential downgrade attacks on first visit.",
          whyItMatters:
            "Without HSTS, users may connect over HTTP before redirect, exposing credentials to network attackers.",
          recommendation:
            "Add Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
          fixDifficulty: "easy",
        },
        {
          whatHappened: "No HSTS header was observed on the primary checkout domain.",
          whyDangerous: "First-time visitors may be vulnerable to SSL stripping on untrusted networks.",
          howToFix: "Configure HSTS at the CDN or web server with a minimum max-age of one year.",
          estimatedRiskReduction: 12,
          priority: "medium",
        },
      ),
    },
    {
      id: "weak-csp",
      severity: "medium",
      title: "Permissive Content Security Policy",
      description:
        "CSP allows unsafe-inline scripts, reducing protection against XSS attacks.",
      affectedFile: "Content-Security-Policy header",
      whyItMatters:
        "Inline script allowances weaken CSP and make XSS exploitation easier if an injection exists.",
      recommendation:
        "Remove unsafe-inline, use nonces or hashes for required inline scripts.",
      fixDifficulty: "hard",
      ai: demoFindingAi(
        {
          description: "CSP allows unsafe-inline scripts, reducing protection against XSS attacks.",
          whyItMatters:
            "Inline script allowances weaken CSP and make XSS exploitation easier if an injection exists.",
          recommendation: "Remove unsafe-inline, use nonces or hashes for required inline scripts.",
          fixDifficulty: "hard",
        },
        {
          whatHappened: "CSP directive script-src includes unsafe-inline.",
          whyDangerous: "Any XSS flaw can execute inline payloads without additional bypasses.",
          howToFix: "Migrate inline scripts to external files and adopt nonce-based CSP.",
          estimatedRiskReduction: 18,
          priority: "medium",
        },
      ),
    },
    {
      id: "cookie-flags",
      severity: "low",
      title: "Session Cookie Missing SameSite=Strict",
      description: "Session cookies are issued with SameSite=Lax instead of Strict on checkout routes.",
      affectedFile: "Set-Cookie: session_id",
      whyItMatters:
        "Cross-site request flows may carry session cookies in edge cases, increasing CSRF exposure.",
      recommendation: "Set SameSite=Strict on session cookies for authenticated checkout flows.",
      fixDifficulty: "easy",
      ai: demoFindingAi(
        {
          description: "Session cookies are issued with SameSite=Lax instead of Strict on checkout routes.",
          whyItMatters:
            "Cross-site request flows may carry session cookies in edge cases, increasing CSRF exposure.",
          recommendation: "Set SameSite=Strict on session cookies for authenticated checkout flows.",
          fixDifficulty: "easy",
        },
        {
          whatHappened: "Session cookie SameSite attribute is Lax on POST-authenticated endpoints.",
          whyDangerous: "Cross-site navigation can attach cookies in some browser edge cases.",
          howToFix:
            "Use SameSite=Strict for session cookies and explicit CSRF tokens on state-changing requests.",
          estimatedRiskReduction: 8,
          priority: "low",
        },
      ),
    },
  ],
  timeline: [...BASE_TIMELINE],
  files: {
    scanned: 18,
    suspicious: 2,
    safe: 15,
    ignored: 1,
  },
  performance: {
    durationMs: 8420,
    filesProcessed: 18,
    averageSpeedPerSecond: 2.1,
    aiTokensUsed: 1840,
  },
  aiAnalysis: {
    executiveSummary:
      "Scanonix identified four actionable issues on the checkout domain with a medium-high risk score. Prioritise XSS and transport security improvements to reduce customer-facing exposure.",
    technicalSummary:
      "Findings span reflected XSS, missing HSTS, permissive CSP, and cookie attribute hardening. Each item maps to a verified scanner result.",
    topPriorities: [
      "[HIGH] Cross Site Scripting (Reflected XSS)",
      "[MEDIUM] Missing Strict-Transport-Security Header",
      "[MEDIUM] Permissive Content Security Policy",
    ],
    overallSecurityPosture:
      "Security posture is medium-high based on scanner findings. Address high severity items first.",
    immediateActions: [
      "Sanitize reflected search input and tighten CSP.",
      "Enable HSTS across the checkout domain.",
    ],
    longTermRecommendations: [
      "Adopt nonce-based CSP and remove unsafe-inline.",
      "Harden session cookie attributes on authenticated routes.",
    ],
    source: "ai",
    generatedAt: new Date().toISOString(),
  },
};

export const CLEAN_SCAN_REPORT: ScanReport = {
  id: "clean",
  target: "invoice-march-2026.pdf",
  targetType: "file",
  completedAt: new Date().toISOString(),
  durationMs: 3120,
  riskScore: 8,
  summary: {
    criticalIssues: 0,
    warnings: 0,
    passedChecks: 31,
    aiConfidence: 97,
  },
  findings: [],
  timeline: [...BASE_TIMELINE],
  files: {
    scanned: 1,
    suspicious: 0,
    safe: 1,
    ignored: 0,
  },
  performance: {
    durationMs: 3120,
    filesProcessed: 1,
    averageSpeedPerSecond: 0.32,
    aiTokensUsed: 420,
  },
  aiAnalysis: {
    executiveSummary:
      "The uploaded file passed static security checks with a low risk score. No actionable issues require immediate remediation.",
    technicalSummary:
      "File extension, MIME type, and size heuristics did not surface suspicious indicators.",
    topPriorities: ["Maintain regular scanning after file or workflow changes."],
    overallSecurityPosture: "Current posture appears strong for this file based on scanner results.",
    immediateActions: ["No urgent remediation is required."],
    longTermRecommendations: [
      "Continue scanning uploads from untrusted sources.",
      "Review storage and sharing permissions periodically.",
    ],
    source: "deterministic",
    generatedAt: new Date().toISOString(),
  },
};

export function getDemoReport(id: string): ScanReport | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  if (id === "clean") return CLEAN_SCAN_REPORT;
  if (id === "demo" || id === "sample") return DEMO_SCAN_REPORT;
  return null;
}
