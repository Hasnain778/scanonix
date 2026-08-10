import { env } from "@/config/env";
import { DOMAIN_REPUTATION_LIMITS } from "@/lib/scan/website/domain-reputation/constants";
import type {
  DomainReputationProvider,
  DomainReputationProviderInput,
  DomainReputationProviderResult,
} from "@/lib/scan/website/domain-reputation/providers/types";

export class GoogleSafeBrowsingProvider implements DomainReputationProvider {
  readonly name = "Google Safe Browsing";

  isConfigured(): boolean {
    return Boolean(env.googleSafeBrowsingApiKey);
  }

  async check(input: DomainReputationProviderInput): Promise<DomainReputationProviderResult> {
    if (!this.isConfigured()) {
      return { provider: this.name, configured: false, result: "skipped", detail: null };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOMAIN_REPUTATION_LIMITS.providerTimeoutMs);

    try {
      const response = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(env.googleSafeBrowsingApiKey)}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client: { clientId: "scanonix", clientVersion: "1.0" },
            threatInfo: {
              threatTypes: [
                "MALWARE",
                "SOCIAL_ENGINEERING",
                "UNWANTED_SOFTWARE",
                "POTENTIALLY_HARMFUL_APPLICATION",
              ],
              platformTypes: ["ANY_PLATFORM"],
              threatEntryTypes: ["URL"],
              threatEntries: [{ url: input.url }],
            },
          }),
        },
      );

      if (!response.ok) {
        return {
          provider: this.name,
          configured: true,
          result: "unknown",
          detail: `Lookup returned HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as { matches?: unknown[] };
      if (Array.isArray(data.matches) && data.matches.length > 0) {
        return {
          provider: this.name,
          configured: true,
          result: "suspicious",
          detail: "URL flagged by Google Safe Browsing",
        };
      }

      return {
        provider: this.name,
        configured: true,
        result: "clean",
        detail: "No Safe Browsing threats reported",
      };
    } catch {
      return { provider: this.name, configured: true, result: "unknown", detail: "Lookup failed" };
    } finally {
      clearTimeout(timeout);
    }
  }
}
