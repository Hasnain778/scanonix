import type { FindingSeverity } from "@/lib/scan-report/types";
import type { HeaderAnalysisInput, SecurityHeaderCheck } from "@/lib/scan/website/types";

interface HeaderDefinition {
  key: string;
  label: string;
  recommended: string;
  missingSeverity: FindingSeverity;
  validate?: (value: string) => { severity?: FindingSeverity; notes?: string } | null;
}

const HEADER_DEFINITIONS: HeaderDefinition[] = [
  {
    key: "content-security-policy",
    label: "Content-Security-Policy",
    recommended: "default-src 'self'; script-src 'self'",
    missingSeverity: "medium",
  },
  {
    key: "strict-transport-security",
    label: "Strict-Transport-Security",
    recommended: "max-age=31536000; includeSubDomains; preload",
    missingSeverity: "medium",
    validate: (value) => {
      const maxAgeMatch = value.match(/max-age=(\d+)/i);
      const maxAge = maxAgeMatch ? Number(maxAgeMatch[1]) : 0;
      if (maxAge > 0 && maxAge < 15552000) {
        return {
          severity: "low",
          notes: "HSTS max-age is shorter than recommended (180 days).",
        };
      }
      return null;
    },
  },
  {
    key: "x-frame-options",
    label: "X-Frame-Options",
    recommended: "DENY or SAMEORIGIN",
    missingSeverity: "low",
  },
  {
    key: "x-content-type-options",
    label: "X-Content-Type-Options",
    recommended: "nosniff",
    missingSeverity: "low",
    validate: (value) => {
      if (!/nosniff/i.test(value)) {
        return { severity: "low", notes: "Expected value: nosniff." };
      }
      return null;
    },
  },
  {
    key: "referrer-policy",
    label: "Referrer-Policy",
    recommended: "strict-origin-when-cross-origin",
    missingSeverity: "info",
  },
  {
    key: "permissions-policy",
    label: "Permissions-Policy",
    recommended: "Restrict sensitive features such as camera, microphone, and geolocation",
    missingSeverity: "info",
  },
  {
    key: "cross-origin-opener-policy",
    label: "Cross-Origin-Opener-Policy",
    recommended: "same-origin",
    missingSeverity: "info",
  },
  {
    key: "cross-origin-resource-policy",
    label: "Cross-Origin-Resource-Policy",
    recommended: "same-origin",
    missingSeverity: "info",
  },
  {
    key: "cross-origin-embedder-policy",
    label: "Cross-Origin-Embedder-Policy",
    recommended: "require-corp",
    missingSeverity: "info",
  },
];

export function analyzeSecurityHeaders(input: HeaderAnalysisInput): SecurityHeaderCheck[] {
  const isHttps = input.finalUrl.startsWith("https://");
  const headers = input.headers;

  return HEADER_DEFINITIONS.map((definition) => {
    const rawValue = headers[definition.key] ?? null;
    const present = Boolean(rawValue);
    let severity = present ? "info" : definition.missingSeverity;
    let notes: string | undefined;

    if (definition.key === "strict-transport-security" && !isHttps) {
      return {
        name: definition.label,
        present,
        value: rawValue,
        recommended: definition.recommended,
        severity: present ? "info" : "high",
        notes: present ? undefined : "HTTPS is not enabled on the final URL.",
      };
    }

    if (present && rawValue && definition.validate) {
      const validation = definition.validate(rawValue);
      if (validation?.severity) {
        severity = validation.severity;
        notes = validation.notes;
      }
    }

    if (!present) {
      severity = definition.missingSeverity;
    }

    return {
      name: definition.label,
      present,
      value: rawValue,
      recommended: definition.recommended,
      severity,
      notes,
    };
  });
}

export function hasClickjackingProtection(headers: Record<string, string>): boolean {
  const xfo = headers["x-frame-options"];
  const csp = headers["content-security-policy"];
  return Boolean(xfo) || Boolean(csp && /frame-ancestors/i.test(csp));
}
