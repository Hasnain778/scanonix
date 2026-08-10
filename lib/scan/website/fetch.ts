import { ScanRunnerError } from "@/lib/scan/types";
import { SCAN_LIMITS, USER_AGENT } from "@/lib/scan/website/constants";
import type { HttpCollectionResult, RedirectHop } from "@/lib/scan/website/types";
import {
  assertSafeRedirectUrl,
  assertSafeResolvedHost,
  normalizeWebsiteUrl,
} from "@/lib/scan/website/validate-url";

function resolveRedirectUrl(current: URL, location: string): URL {
  try {
    return new URL(location, current);
  } catch {
    throw new ScanRunnerError("network", "Encountered an invalid redirect location.");
  }
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value.slice(0, SCAN_LIMITS.maxHeaderLength);
  });
  return record;
}

function extractMetaContent(html: string, name: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']|` +
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`,
    "i",
  );
  const match = html.match(pattern);
  const value = (match?.[1] ?? match?.[2] ?? "").trim();
  return value || null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return null;
  return match[1].replace(/\s+/g, " ").trim().slice(0, 300) || null;
}

function extractCanonical(html: string): string | null {
  const match = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']|<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i,
  );
  const value = (match?.[1] ?? match?.[2] ?? "").trim();
  return value || null;
}

async function readLimitedBody(response: Response): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (total < SCAN_LIMITS.maxBodyBytes) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const remaining = SCAN_LIMITS.maxBodyBytes - total;
    const slice = value.byteLength > remaining ? value.slice(0, remaining) : value;
    chunks.push(slice);
    total += slice.byteLength;
    if (value.byteLength > remaining) break;
  }

  await reader.cancel().catch(() => undefined);

  const merged = Buffer.concat(chunks);
  return merged.toString("utf8", 0, merged.length);
}

export async function fetchWebsite(inputTarget: string): Promise<HttpCollectionResult> {
  const inputUrl = normalizeWebsiteUrl(inputTarget);
  const ipAddress = await assertSafeResolvedHost(inputUrl.hostname);

  const redirectChain: RedirectHop[] = [];
  let currentUrl = inputUrl;
  let response: Response | null = null;
  const started = Date.now();

  for (let hop = 0; hop <= SCAN_LIMITS.maxRedirects; hop += 1) {
    const hopStarted = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SCAN_LIMITS.fetchTimeoutMs);

    try {
      response = await fetch(currentUrl.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-GB,en;q=0.9",
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ScanRunnerError("timeout", "The website took too long to respond.");
      }
      throw new ScanRunnerError(
        "network",
        "Could not reach the website. Check the URL and try again.",
      );
    } finally {
      clearTimeout(timeout);
    }

    redirectChain.push({
      url: currentUrl.toString(),
      status: response.status,
      durationMs: Date.now() - hopStarted,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new ScanRunnerError("network", "Redirect response missing Location header.");
      }

      const nextUrl = resolveRedirectUrl(currentUrl, location);
      if (!["http:", "https:"].includes(nextUrl.protocol)) {
        throw new ScanRunnerError("invalid_target", "Redirect to unsupported URL scheme.");
      }

      await assertSafeRedirectUrl(nextUrl);
      await response.body?.cancel().catch(() => undefined);
      currentUrl = nextUrl;
      continue;
    }

    break;
  }

  if (!response) {
    throw new ScanRunnerError("network", "No response received from the website.");
  }

  if (redirectChain.length > SCAN_LIMITS.maxRedirects) {
    throw new ScanRunnerError("network", "Too many redirects while scanning the website.");
  }

  const contentType = response.headers.get("content-type");
  const isHtml = contentType?.toLowerCase().includes("text/html") ?? false;
  const body = isHtml ? await readLimitedBody(response) : "";

  const headerRecord = headersToRecord(response.headers);
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  const rawHeaderLines = [
    ...response.headers.entries(),
    ...setCookies.map((cookie) => ["set-cookie", cookie] as const),
  ].map(([key, value]) => `${key}: ${value.slice(0, SCAN_LIMITS.maxHeaderLength)}`);

  return {
    inputUrl: inputUrl.toString(),
    finalUrl: currentUrl.toString(),
    status: response.status,
    responseTimeMs: Date.now() - started,
    redirectChain,
    headers: headerRecord,
    rawHeaderLines,
    body,
    contentType,
    serverHeader: response.headers.get("server"),
    poweredByHeader: response.headers.get("x-powered-by"),
    ipAddress,
    pageTitle: isHtml ? extractTitle(body) : null,
    metaDescription: isHtml ? extractMetaContent(body, "description") : null,
    canonicalUrl: isHtml ? extractCanonical(body) : null,
  };
}
