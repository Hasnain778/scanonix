import { env } from "@/config/env";
import { DOMAIN_REPUTATION_LIMITS } from "@/lib/scan/website/domain-reputation/constants";
import type {
  DomainReputationProvider,
  DomainReputationProviderInput,
  DomainReputationProviderResult,
} from "@/lib/scan/website/domain-reputation/providers/types";

export class UrlHausProvider implements DomainReputationProvider {
  readonly name = "URLHaus";

  isConfigured(): boolean {
    return Boolean(env.urlHausApiKey);
  }

  async check(input: DomainReputationProviderInput): Promise<DomainReputationProviderResult> {
    if (!this.isConfigured()) {
      return { provider: this.name, configured: false, result: "skipped", detail: null };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOMAIN_REPUTATION_LIMITS.providerTimeoutMs);

    try {
      const body = new URLSearchParams({
        url: input.url,
        token: env.urlHausApiKey,
      });

      const response = await fetch("https://urlhaus-api.abuse.ch/v1/url/", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!response.ok) {
        return {
          provider: this.name,
          configured: true,
          result: "unknown",
          detail: `Lookup returned HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as {
        query_status?: string;
        url_status?: string;
        threat?: string;
      };

      if (data.query_status === "ok" && data.url_status && data.url_status !== "online") {
        return {
          provider: this.name,
          configured: true,
          result: "suspicious",
          detail: `URL listed — status: ${data.url_status}${data.threat ? ` (${data.threat})` : ""}`,
        };
      }

      if (data.query_status === "no_results") {
        return {
          provider: this.name,
          configured: true,
          result: "clean",
          detail: "URL not found in URLHaus database",
        };
      }

      return {
        provider: this.name,
        configured: true,
        result: "unknown",
        detail: data.query_status ?? "Unknown response",
      };
    } catch {
      return { provider: this.name, configured: true, result: "unknown", detail: "Lookup failed" };
    } finally {
      clearTimeout(timeout);
    }
  }
}
