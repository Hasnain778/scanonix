import { USER_AGENT } from "@/lib/scan/website/constants";
import { THREAT_LIMITS } from "@/lib/scan/website/threats/constants";
import { assertSafeRedirectUrl, normalizeWebsiteUrl } from "@/lib/scan/website/validate-url";

export interface FetchedExternalScript {
  url: string;
  content: string;
  bytes: number;
}

export async function fetchExternalScripts(
  scriptUrls: string[],
  pageUrl: string,
  bytesBudget: number,
): Promise<{ scripts: FetchedExternalScript[]; bytesUsed: number }> {
  const scripts: FetchedExternalScript[] = [];
  let bytesUsed = 0;
  const pageOrigin = new URL(pageUrl).origin;

  const candidates = scriptUrls.slice(0, THREAT_LIMITS.maxExternalScripts);

  for (const rawUrl of candidates) {
    if (bytesUsed >= bytesBudget) break;

    let resolved: URL;
    try {
      resolved = new URL(rawUrl, pageUrl);
    } catch {
      continue;
    }

    if (!["http:", "https:"].includes(resolved.protocol)) {
      continue;
    }

    try {
      await assertSafeRedirectUrl(resolved);
    } catch {
      continue;
    }

    // Prefer same-origin scripts; still allow external with SSRF checks above.
    void pageOrigin;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), THREAT_LIMITS.scriptFetchTimeoutMs);

    try {
      const response = await fetch(resolved.toString(), {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "*/*",
        },
      });

      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        continue;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (
        contentType &&
        !/javascript|ecmascript|text\/plain|application\/json/i.test(contentType)
      ) {
        await response.body?.cancel().catch(() => undefined);
        continue;
      }

      const reader = response.body?.getReader();
      if (!reader) continue;

      const chunks: Uint8Array[] = [];
      let fetched = 0;
      const maxBytes = Math.min(
        THREAT_LIMITS.maxScriptBytes,
        bytesBudget - bytesUsed,
      );

      while (fetched < maxBytes) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        const slice = value.byteLength > maxBytes - fetched ? value.slice(0, maxBytes - fetched) : value;
        chunks.push(slice);
        fetched += slice.byteLength;
      }

      await reader.cancel().catch(() => undefined);

      const content = Buffer.concat(chunks).toString("utf8");
      bytesUsed += fetched;
      scripts.push({ url: resolved.toString(), content, bytes: fetched });
    } catch {
      // Skip unreachable or blocked external scripts.
    } finally {
      clearTimeout(timeout);
    }
  }

  return { scripts, bytesUsed };
}

export function resolveScriptUrl(rawUrl: string, pageUrl: string): string | null {
  try {
    const normalized = normalizeWebsiteUrl(rawUrl.startsWith("http") ? rawUrl : new URL(rawUrl, pageUrl).toString());
    return normalized.toString();
  } catch {
    try {
      return new URL(rawUrl, pageUrl).toString();
    } catch {
      return null;
    }
  }
}
