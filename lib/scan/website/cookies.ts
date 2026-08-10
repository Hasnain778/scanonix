import type { CookieAnalysisInput, CookieInspection } from "@/lib/scan/website/types";

function parseSetCookieHeader(line: string): CookieInspection | null {
  const value = line.replace(/^set-cookie:\s*/i, "").trim();
  if (!value) return null;

  const parts = value.split(";").map((part) => part.trim());
  const namePart = parts[0] ?? "";
  const name = namePart.split("=")[0]?.trim();
  if (!name) return null;

  const flags = parts.slice(1).map((part) => part.toLowerCase());
  const secure = flags.some((flag) => flag === "secure");
  const httpOnly = flags.some((flag) => flag === "httponly");
  const sameSitePart = flags.find((flag) => flag.startsWith("samesite"));
  const sameSite = sameSitePart ? sameSitePart.split("=")[1]?.trim() ?? sameSitePart : null;

  const missingFlags: string[] = [];
  if (!secure) missingFlags.push("Secure");
  if (!httpOnly) missingFlags.push("HttpOnly");
  if (!sameSite) missingFlags.push("SameSite");

  let severity: CookieInspection["severity"] = "info";
  if (!secure || !httpOnly) {
    severity = "medium";
  }
  if (!secure && !httpOnly && !sameSite) {
    severity = "high";
  }

  return {
    name,
    secure,
    httpOnly,
    sameSite,
    missingFlags,
    severity,
  };
}

export function analyzeCookies(input: CookieAnalysisInput): CookieInspection[] {
  const cookies = input.rawHeaderLines
    .filter((line) => line.toLowerCase().startsWith("set-cookie:"))
    .map(parseSetCookieHeader)
    .filter((cookie): cookie is CookieInspection => cookie !== null);

  if (input.isHttps) {
    return cookies;
  }

  return cookies.map((cookie) => ({
    ...cookie,
    severity: cookie.secure ? cookie.severity : "high",
    missingFlags: cookie.secure ? cookie.missingFlags : [...new Set([...cookie.missingFlags, "Secure"])],
  }));
}
