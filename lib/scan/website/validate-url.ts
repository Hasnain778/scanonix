import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ScanRunnerError } from "@/lib/scan/types";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "metadata.goog",
]);

const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost"];

function isPrivateOrReservedIpv4(octets: number[]): boolean {
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateOrReservedIp(address: string): boolean {
  const normalized = address.toLowerCase();

  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") {
    return true;
  }

  if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }

  const ipVersion = isIP(address);
  if (ipVersion === 4) {
    const octets = address.split(".").map((part) => Number(part));
    if (octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
      return true;
    }
    return isPrivateOrReservedIpv4(octets);
  }

  return false;
}

function hostnameLooksBlocked(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, "");

  if (BLOCKED_HOSTNAMES.has(lower)) {
    return true;
  }

  if (BLOCKED_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
    return true;
  }

  if (isIP(lower) !== 0 && isPrivateOrReservedIp(lower)) {
    return true;
  }

  return false;
}

export function normalizeWebsiteUrl(rawTarget: string): URL {
  const trimmed = rawTarget.trim();
  if (!trimmed) {
    throw new ScanRunnerError("invalid_target", "Enter a website URL to scan.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new ScanRunnerError("invalid_target", "Enter a valid website URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ScanRunnerError(
      "invalid_target",
      "Only HTTP and HTTPS URLs are supported.",
    );
  }

  if (parsed.username || parsed.password) {
    throw new ScanRunnerError("invalid_target", "URLs with embedded credentials are not allowed.");
  }

  if (!parsed.hostname) {
    throw new ScanRunnerError("invalid_target", "Enter a valid website hostname.");
  }

  if (hostnameLooksBlocked(parsed.hostname)) {
    throw new ScanRunnerError(
      "invalid_target",
      "Local, private, and internal addresses cannot be scanned.",
    );
  }

  return parsed;
}

export async function assertSafeResolvedHost(hostname: string): Promise<string> {
  if (hostnameLooksBlocked(hostname)) {
    throw new ScanRunnerError(
      "invalid_target",
      "Local, private, and internal addresses cannot be scanned.",
    );
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ScanRunnerError("network", "Could not resolve the website hostname.");
  }

  if (addresses.length === 0) {
    throw new ScanRunnerError("network", "Could not resolve the website hostname.");
  }

  for (const entry of addresses) {
    if (isPrivateOrReservedIp(entry.address)) {
      throw new ScanRunnerError(
        "invalid_target",
        "The website resolves to a private or restricted IP address.",
      );
    }
  }

  return addresses[0]?.address ?? "";
}

export async function assertSafeRedirectUrl(url: URL): Promise<void> {
  if (hostnameLooksBlocked(url.hostname)) {
    throw new ScanRunnerError(
      "invalid_target",
      "Redirect target points to a blocked address.",
    );
  }

  await assertSafeResolvedHost(url.hostname);
}

export { isPrivateOrReservedIp, hostnameLooksBlocked };
