import type { ScanReportFinding } from "@/lib/scan-report/types";
import { hasClickjackingProtection } from "@/lib/scan/website/headers";
import type { WebsiteIntelligence } from "@/lib/scan/website/types";

function finding(
  partial: Omit<ScanReportFinding, "fixDifficulty"> & { fixDifficulty?: ScanReportFinding["fixDifficulty"] },
): ScanReportFinding {
  return {
    fixDifficulty: "moderate",
    ...partial,
  };
}

export function buildFindingsFromIntelligence(intelligence: WebsiteIntelligence): ScanReportFinding[] {
  const findings: ScanReportFinding[] = [];

  if (intelligence.finalUrl.startsWith("http://")) {
    findings.push(
      finding({
        id: "insecure-transport",
        severity: "high",
        title: "Website served over HTTP",
        description: "The final URL is not served over HTTPS.",
        affectedFile: intelligence.finalUrl,
        whyItMatters: "Traffic can be intercepted or modified on untrusted networks.",
        recommendation: "Redirect all traffic to HTTPS and enable HSTS.",
        fixDifficulty: "moderate",
      }),
    );
  }

  if (!intelligence.ssl.enabled) {
    findings.push(
      finding({
        id: "https-disabled",
        severity: "high",
        title: "HTTPS is not enabled",
        description: "TLS could not be established for the target hostname.",
        affectedFile: intelligence.finalUrl,
        whyItMatters: "Without HTTPS, credentials and session data are exposed in transit.",
        recommendation: "Install a valid TLS certificate and serve the site over HTTPS.",
        fixDifficulty: "moderate",
      }),
    );
  } else if (!intelligence.ssl.valid) {
    findings.push(
      finding({
        id: "invalid-certificate",
        severity: "critical",
        title: "Invalid or expired TLS certificate",
        description: intelligence.ssl.error ?? "The TLS certificate failed validation.",
        affectedFile: intelligence.finalUrl,
        whyItMatters: "Browsers may block access and users cannot trust the connection.",
        recommendation: "Renew the certificate and ensure the full chain is configured correctly.",
        fixDifficulty: "moderate",
      }),
    );
  } else if (
    intelligence.ssl.daysRemaining !== null &&
    intelligence.ssl.daysRemaining <= 30
  ) {
    findings.push(
      finding({
        id: "certificate-expiring",
        severity: intelligence.ssl.daysRemaining <= 7 ? "high" : "medium",
        title: "TLS certificate expiring soon",
        description: `Certificate expires in ${intelligence.ssl.daysRemaining} day(s).`,
        affectedFile: intelligence.finalUrl,
        whyItMatters: "An expired certificate breaks HTTPS and erodes user trust.",
        recommendation: "Renew the certificate before expiration and automate renewal where possible.",
        fixDifficulty: "easy",
      }),
    );
  }

  for (const header of intelligence.securityHeaders) {
    if (header.present) {
      if (header.notes && header.severity !== "info") {
        findings.push(
          finding({
            id: `header-weak-${header.name.toLowerCase().replace(/\s+/g, "-")}`,
            severity: header.severity,
            title: `${header.name} needs improvement`,
            description: header.notes,
            affectedFile: "HTTP response headers",
            whyItMatters: "Weak security headers reduce defense-in-depth.",
            recommendation: `Use recommended value: ${header.recommended}`,
            fixDifficulty: "easy",
          }),
        );
      }
      continue;
    }

    if (header.severity === "info") {
      continue;
    }

    findings.push(
      finding({
        id: `header-missing-${header.name.toLowerCase().replace(/\s+/g, "-")}`,
        severity: header.severity,
        title: `Missing ${header.name}`,
        description: `The ${header.name} header was not present in the response.`,
        affectedFile: "HTTP response headers",
        whyItMatters: "Missing headers reduce protection against common web attacks.",
        recommendation: `Add ${header.name}. Recommended: ${header.recommended}`,
        fixDifficulty: header.name.includes("Content-Security-Policy") ? "hard" : "easy",
      }),
    );
  }

  if (!hasClickjackingProtection(intelligence.responseHeaders)) {
    const alreadyReported = findings.some((item) => item.id.includes("frame"));
    if (!alreadyReported) {
      findings.push(
        finding({
          id: "clickjacking-protection",
          severity: "low",
          title: "Missing clickjacking protection",
          description: "Neither X-Frame-Options nor CSP frame-ancestors was detected.",
          affectedFile: "HTTP response headers",
          whyItMatters: "The site may be embedded in malicious frames.",
          recommendation: "Set X-Frame-Options: DENY or CSP frame-ancestors 'none'.",
          fixDifficulty: "easy",
        }),
      );
    }
  }

  for (const cookie of intelligence.cookies) {
    if (cookie.missingFlags.length === 0) continue;

    findings.push(
      finding({
        id: `cookie-${cookie.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        severity: cookie.severity,
        title: `Cookie "${cookie.name}" missing security flags`,
        description: `Missing: ${cookie.missingFlags.join(", ")}.`,
        affectedFile: "Set-Cookie headers",
        whyItMatters: "Session cookies without Secure/HttpOnly/SameSite are easier to steal or misuse.",
        recommendation: "Set Secure, HttpOnly, and SameSite=Lax or Strict on sensitive cookies.",
        fixDifficulty: "easy",
      }),
    );
  }

  if (intelligence.redirectAnalysis.redirectLoop) {
    findings.push(
      finding({
        id: "redirect-loop",
        severity: "high",
        title: "Redirect loop detected",
        description: intelligence.redirectAnalysis.notes.join(" "),
        affectedFile: intelligence.finalUrl,
        whyItMatters: "Redirect loops break availability and may indicate misconfiguration.",
        recommendation: "Review redirect rules and canonical host configuration.",
        fixDifficulty: "moderate",
      }),
    );
  }

  if (intelligence.redirectAnalysis.excessiveRedirects) {
    findings.push(
      finding({
        id: "excessive-redirects",
        severity: "medium",
        title: "Excessive redirects",
        description: intelligence.redirectAnalysis.notes.join(" "),
        affectedFile: intelligence.finalUrl,
        whyItMatters: "Long redirect chains increase latency and attack surface.",
        recommendation: "Reduce redirect hops and enforce a single canonical URL.",
        fixDifficulty: "moderate",
      }),
    );
  }

  if (
    intelligence.redirectAnalysis.suspiciousChain &&
    !intelligence.redirectAnalysis.redirectLoop
  ) {
    findings.push(
      finding({
        id: "suspicious-redirect-chain",
        severity: "medium",
        title: "Cross-domain redirect chain detected",
        description: intelligence.redirectAnalysis.notes.join(" "),
        affectedFile: intelligence.finalUrl,
        whyItMatters: "Unexpected cross-domain redirects may indicate compromise or misconfiguration.",
        recommendation: "Verify all redirect destinations are trusted and intended.",
        fixDifficulty: "moderate",
      }),
    );
  }

  if (intelligence.httpStatus >= 500) {
    findings.push(
      finding({
        id: "server-error",
        severity: "medium",
        title: "Server returned an error response",
        description: `The website responded with HTTP ${intelligence.httpStatus}.`,
        affectedFile: intelligence.finalUrl,
        whyItMatters: "Server errors may indicate instability or misconfiguration.",
        recommendation: "Review server logs and uptime monitoring.",
        fixDifficulty: "moderate",
      }),
    );
  }

  if (intelligence.pageAnalysis.formCount > 0 && !intelligence.finalUrl.startsWith("https://")) {
    const alreadyReported = findings.some((item) => item.id === "insecure-transport");
    if (!alreadyReported) {
      findings.push(
        finding({
          id: "forms-over-http",
          severity: "high",
          title: "Forms detected on non-HTTPS page",
          description: `${intelligence.pageAnalysis.formCount} form(s) were found on an HTTP page.`,
          affectedFile: intelligence.finalUrl,
          whyItMatters: "Form submissions over HTTP expose user input to network attackers.",
          recommendation: "Serve all pages with forms over HTTPS.",
          fixDifficulty: "moderate",
        }),
      );
    }
  }

  if (findings.length === 0) {
    findings.push(
      finding({
        id: "no-significant-issues",
        severity: "info",
        title: "No significant issues detected",
        description: "Real checks completed without identifying major security gaps.",
        affectedFile: intelligence.finalUrl,
        whyItMatters: "This reflects the checks run in Phase 1 and does not guarantee full coverage.",
        recommendation: "Re-scan after infrastructure changes and monitor headers and TLS renewal.",
        fixDifficulty: "easy",
      }),
    );
  }

  return findings;
}
