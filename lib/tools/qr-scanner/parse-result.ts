import type { ParsedQrResult, QrResultType, WifiDetails } from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+]?[\d\s().-]{7,}$/;

function parseWifiPayload(data: string): WifiDetails | null {
  if (!data.toUpperCase().startsWith("WIFI:")) {
    return null;
  }

  const content = data.slice(5);
  const fields: Record<string, string> = {};

  for (const segment of content.split(";")) {
    const separatorIndex = segment.indexOf(":");
    if (separatorIndex <= 0) continue;
    const key = segment.slice(0, separatorIndex).toUpperCase();
    const value = segment.slice(separatorIndex + 1);
    fields[key] = value;
  }

  if (!fields.S) {
    return null;
  }

  return {
    ssid: fields.S,
    password: fields.P ?? "",
    security: fields.T ?? "Unknown",
  };
}

function normaliseUrl(value: string): string | null {
  const trimmed = value.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return trimmed;
      }
    } catch {
      return null;
    }
  }

  if (/^www\./i.test(trimmed) && trimmed.includes(".")) {
    return `https://${trimmed}`;
  }

  return null;
}

export function parseQrContent(raw: string): ParsedQrResult {
  const trimmed = raw.trim();

  if (trimmed.toLowerCase().startsWith("mailto:")) {
    const email = trimmed.slice(7).split("?")[0].trim();
    return {
      type: "email",
      raw: trimmed,
      displayValue: email,
      email,
    };
  }

  if (trimmed.toLowerCase().startsWith("tel:")) {
    const phone = trimmed.slice(4).trim();
    return {
      type: "phone",
      raw: trimmed,
      displayValue: phone,
      phone,
    };
  }

  const wifi = parseWifiPayload(trimmed);
  if (wifi) {
    return {
      type: "wifi",
      raw: trimmed,
      displayValue: wifi.ssid,
      wifi,
    };
  }

  const url = normaliseUrl(trimmed);
  if (url) {
    return {
      type: "url",
      raw: trimmed,
      displayValue: url,
      url,
    };
  }

  if (EMAIL_PATTERN.test(trimmed)) {
    return {
      type: "email",
      raw: trimmed,
      displayValue: trimmed,
      email: trimmed,
    };
  }

  if (PHONE_PATTERN.test(trimmed)) {
    return {
      type: "phone",
      raw: trimmed,
      displayValue: trimmed,
      phone: trimmed.replace(/\s+/g, ""),
    };
  }

  return {
    type: "text" as QrResultType,
    raw: trimmed,
    displayValue: trimmed,
  };
}

export function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function buildMailtoLink(email: string): string {
  return `mailto:${encodeURIComponent(email)}`;
}

export function buildTelLink(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}
