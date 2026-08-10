import { env } from "@/config/env";
import { DOMAIN_REPUTATION_LIMITS } from "@/lib/scan/website/domain-reputation/constants";
import type {
  DomainReputationProvider,
  DomainReputationProviderInput,
  DomainReputationProviderResult,
} from "@/lib/scan/website/domain-reputation/providers/types";

export class PhishTankProvider implements DomainReputationProvider {
  readonly name = "PhishTank";

  isConfigured(): boolean {
    return Boolean(env.phishTankApiKey);
  }

  async check(input: DomainReputationProviderInput): Promise<DomainReputationProviderResult> {
    if (!this.isConfigured()) {
      return { provider: this.name, configured: false, result: "skipped", detail: null };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOMAIN_REPUTATION_LIMITS.providerTimeoutMs);

    try {
      const params = new URLSearchParams({
        url: input.url,
        format: "json",
        app_key: env.phishTankApiKey,
      });

      const response = await fetch(
        `https://checkurl.phishtank.com/checkurl/?${params.toString()}`,
        {
          method: "GET",
          signal: controller.signal,
          headers: { "User-Agent": "Scanonix/1.0" },
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

      const data = (await response.json()) as {
        results?: { in_database?: boolean; valid?: boolean };
      };

      if (data.results?.in_database && data.results.valid) {
        return {
          provider: this.name,
          configured: true,
          result: "suspicious",
          detail: "URL verified as phishing in PhishTank",
        };
      }

      return {
        provider: this.name,
        configured: true,
        result: "clean",
        detail: "URL not verified as phishing in PhishTank",
      };
    } catch {
      return { provider: this.name, configured: true, result: "unknown", detail: "Lookup failed" };
    } finally {
      clearTimeout(timeout);
    }
  }
}
