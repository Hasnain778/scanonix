import type { TrustLevel } from "@/lib/scan/website/domain-reputation/constants";
import type {
  DomainDnsHealth,
  DomainReputationMatch,
  ExternalProviderResult,
} from "@/lib/scan/website/domain-reputation/types";

const SEVERITY_PENALTY: Record<DomainReputationMatch["severity"], number> = {
  critical: 35,
  high: 22,
  medium: 12,
  low: 5,
  info: 1,
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateReputationScore(params: {
  matches: DomainReputationMatch[];
  dnsHealth: DomainDnsHealth;
  externalProviders: ExternalProviderResult[];
  registrationAvailable: boolean;
}): number {
  let score = 100;

  for (const match of params.matches) {
    score -= SEVERITY_PENALTY[match.severity] ?? 0;
  }

  if (params.dnsHealth.level === "broken") {
    score -= 15;
  } else if (params.dnsHealth.level === "degraded") {
    score -= 8;
  }

  for (const provider of params.externalProviders) {
    if (provider.result === "suspicious") {
      score -= 25;
    }
  }

  if (!params.registrationAvailable) {
    score -= 5;
  }

  return clampScore(score);
}

export function deriveTrustLevel(reputationScore: number): TrustLevel {
  if (reputationScore >= 80) return "high";
  if (reputationScore >= 60) return "moderate";
  if (reputationScore >= 40) return "low";
  return "poor";
}

export function buildReputationSummary(params: {
  domain: string;
  reputationScore: number;
  trustLevel: TrustLevel;
  riskReasons: string[];
  registrar: string | null;
  ageDays: number | null;
}): string {
  const ageText =
    params.ageDays !== null
      ? `${params.ageDays} day${params.ageDays === 1 ? "" : "s"} old`
      : "unknown age";

  if (params.riskReasons.length === 0) {
    return `Domain ${params.domain} has a ${params.trustLevel} trust level (reputation score ${params.reputationScore}/100). Registration: ${ageText}${params.registrar ? `, registrar ${params.registrar}` : ""}. No significant reputation risk signals detected.`;
  }

  const reasons = params.riskReasons.slice(0, 4).join(", ");
  return `Domain ${params.domain} has a ${params.trustLevel} trust level (reputation score ${params.reputationScore}/100). Registration: ${ageText}${params.registrar ? `, registrar ${params.registrar}` : ""}. Risk signals: ${reasons}.`;
}
