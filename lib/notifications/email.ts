/**
 * Server-only transactional email transport (Resend REST).
 * Never import from client components.
 */

import { env } from "@/config/env";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 8_000;
const MAX_TEXT_CHARS = 4_000;

export const EMAIL_FAILURE_CODES = [
  "missing_configuration",
  "invalid_recipient",
  "invalid_from_address",
  "provider_client_error",
  "provider_server_error",
  "network_error",
  "timeout",
  "unexpected_response",
] as const;

export type EmailFailureCode = (typeof EMAIL_FAILURE_CODES)[number];

export type SendEmailResult =
  | { ok: true }
  | { ok: false; code: EmailFailureCode };

export interface MonitorAlertEmailInput {
  to: string;
  subject: string;
  text: string;
}

export interface MonitorAlertContentInput {
  targetUrl?: unknown;
  riskScore?: unknown;
  summary?: unknown;
  monitorId?: unknown;
}

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isPlausibleEmailAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 254) return false;
  if (trimmed.includes("\n") || trimmed.includes("\r")) return false;
  return SIMPLE_EMAIL.test(trimmed);
}

export interface EmailTransportOptions {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  fromAddress?: string;
}

export function resolveMonitorEmailConfig(override?: EmailTransportOptions): {
  apiKey: string;
  fromAddress: string;
} {
  return {
    apiKey: (override?.apiKey ?? env.resendApiKey).trim(),
    fromAddress: (override?.fromAddress ?? env.emailFromAddress).trim(),
  };
}

export function isMonitorEmailConfigured(override?: EmailTransportOptions): boolean {
  const { apiKey, fromAddress } = resolveMonitorEmailConfig(override);
  return Boolean(apiKey && isPlausibleEmailAddress(fromAddress));
}

export async function sendMonitorAlertEmail(
  input: MonitorAlertEmailInput,
  options: EmailTransportOptions = {},
): Promise<SendEmailResult> {
  if (typeof window !== "undefined") {
    return { ok: false, code: "unexpected_response" };
  }

  const { apiKey, fromAddress } = resolveMonitorEmailConfig(options);
  if (!apiKey || !fromAddress) {
    return { ok: false, code: "missing_configuration" };
  }
  if (!isPlausibleEmailAddress(fromAddress)) {
    return { ok: false, code: "invalid_from_address" };
  }
  if (!isPlausibleEmailAddress(input.to)) {
    return { ok: false, code: "invalid_recipient" };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const response = await fetchImpl(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [input.to.trim()],
        subject: clipText(input.subject, 200),
        text: clipText(input.text),
      }),
      signal: controller.signal,
    });

    if (response.status >= 200 && response.status < 300) {
      return { ok: true };
    }
    if (response.status >= 400 && response.status < 500) {
      return { ok: false, code: "provider_client_error" };
    }
    if (response.status >= 500) {
      return { ok: false, code: "provider_server_error" };
    }
    return { ok: false, code: "unexpected_response" };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "AbortError" || name === "TimeoutError") {
      return { ok: false, code: "timeout" };
    }
    return { ok: false, code: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

function clipText(value: string, max = MAX_TEXT_CHARS): string {
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

export function trustedHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function buildMonitorAlertText(
  input: MonitorAlertContentInput,
  siteUrl: string,
): { subject: string; text: string } {
  const targetUrl = trustedHttpUrl(input.targetUrl);
  const summary =
    typeof input.summary === "string" && input.summary.trim()
      ? clipText(input.summary, 500)
      : "A security change was detected on a monitored website.";
  const riskScore =
    typeof input.riskScore === "number" &&
    Number.isFinite(input.riskScore) &&
    input.riskScore >= 0 &&
    input.riskScore <= 100
      ? Math.round(input.riskScore)
      : null;

  const monitorPath =
    typeof input.monitorId === "string" && /^[0-9a-f-]{36}$/i.test(input.monitorId)
      ? `/monitors/${input.monitorId}`
      : "/monitors";

  let origin = siteUrl.replace(/\/+$/, "");
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    origin = siteUrl.replace(/\/+$/, "");
  }
  const reportLink = `${origin}${monitorPath}`;

  const lines = [
    "Scanonix monitor alert",
    "",
    summary,
  ];
  if (riskScore !== null) {
    lines.push("", `Risk score: ${riskScore}/100`);
  }
  if (targetUrl) {
    lines.push("", `Monitored website: ${targetUrl}`);
  }
  lines.push("", `Open monitor: ${reportLink}`, "", "You received this because you own this Scanonix monitor.");

  return {
    subject: targetUrl ? `Scanonix monitor alert — ${new URL(targetUrl).hostname}` : "Scanonix monitor alert",
    text: clipText(lines.join("\n")),
  };
}

