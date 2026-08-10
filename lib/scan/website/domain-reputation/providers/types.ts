export interface DomainReputationProviderInput {
  domain: string;
  url: string;
}

export interface DomainReputationProviderResult {
  provider: string;
  configured: boolean;
  result: "clean" | "suspicious" | "unknown" | "skipped";
  detail: string | null;
}

export interface DomainReputationProvider {
  readonly name: string;
  isConfigured(): boolean;
  check(input: DomainReputationProviderInput): Promise<DomainReputationProviderResult>;
}
