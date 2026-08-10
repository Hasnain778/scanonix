import { GoogleSafeBrowsingProvider } from "@/lib/scan/website/domain-reputation/providers/google-safe-browsing";
import { PhishTankProvider } from "@/lib/scan/website/domain-reputation/providers/phishtank";
import type {
  DomainReputationProvider,
  DomainReputationProviderInput,
  DomainReputationProviderResult,
} from "@/lib/scan/website/domain-reputation/providers/types";
import { UrlHausProvider } from "@/lib/scan/website/domain-reputation/providers/urlhaus";
let cachedProviders: DomainReputationProvider[] | null = null;

export function getDomainReputationProviders(): DomainReputationProvider[] {
  if (!cachedProviders) {
    cachedProviders = [
      new GoogleSafeBrowsingProvider(),
      new UrlHausProvider(),
      new PhishTankProvider(),
    ];
  }
  return cachedProviders;
}

export async function runExternalReputationProviders(
  input: DomainReputationProviderInput,
): Promise<DomainReputationProviderResult[]> {
  const providers = getDomainReputationProviders();
  const configured = providers.filter((provider) => provider.isConfigured());

  if (configured.length === 0) {
    return providers.map((provider) => ({
      provider: provider.name,
      configured: false,
      result: "skipped" as const,
      detail: null,
    }));
  }

  const results = await Promise.all(
    configured.map(async (provider) => {
      try {
        return await provider.check(input);
      } catch {
        return {
          provider: provider.name,
          configured: true,
          result: "unknown" as const,
          detail: "Provider check failed",
        };
      }
    }),
  );

  const skipped = providers
    .filter((provider) => !provider.isConfigured())
    .map((provider) => ({
      provider: provider.name,
      configured: false,
      result: "skipped" as const,
      detail: null,
    }));

  return [...results, ...skipped];
}

export type {
  DomainReputationProvider,
  DomainReputationProviderInput,
  DomainReputationProviderResult,
} from "@/lib/scan/website/domain-reputation/providers/types";
