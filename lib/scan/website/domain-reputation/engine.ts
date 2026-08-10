import { analyzeDnsHealth } from "@/lib/scan/website/domain-reputation/analyze-dns";
import { collectDnsRecords, lookupAsn, lookupReverseDns } from "@/lib/scan/website/domain-reputation/dns-records";
import { runExternalReputationProviders } from "@/lib/scan/website/domain-reputation/providers";
import { lookupDomainRegistration } from "@/lib/scan/website/domain-reputation/rdap";
import {
  buildDomainRiskMatches,
  collectRiskReasons,
} from "@/lib/scan/website/domain-reputation/risk-signals";
import {
  buildReputationSummary,
  calculateReputationScore,
  deriveTrustLevel,
} from "@/lib/scan/website/domain-reputation/scoring";
import type {
  DomainReputationInput,
  DomainReputationMatch,
  DomainReputationResult,
} from "@/lib/scan/website/domain-reputation/types";

const CHECKS_TOTAL = 5;

function extractDomain(finalUrl: string): string | null {
  try {
    return new URL(finalUrl).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

function providerMatches(
  externalProviders: DomainReputationResult["externalProviders"],
): DomainReputationMatch[] {
  const matches: DomainReputationMatch[] = [];

  for (const provider of externalProviders) {
    if (provider.result !== "suspicious") continue;

    matches.push({
      id: `domain-rep-provider-${provider.provider.toLowerCase().replace(/\s+/g, "-")}`,
      category: "domain-reputation",
      severity: "high",
      title: `${provider.provider} flagged this domain`,
      description: provider.detail ?? "External reputation provider reported suspicious activity.",
      whyItMatters:
        "Third-party threat intelligence feeds aggregate global abuse reports for this domain or URL.",
      evidence: provider.detail ?? provider.provider,
      recommendation:
        "Investigate immediately and avoid sharing credentials until the domain is verified clean.",
      confidence: "high",
      affectedResource: provider.provider,
      fixDifficulty: "hard",
    });
  }

  return matches;
}

export async function runDomainReputationAnalysis(
  input: DomainReputationInput,
): Promise<DomainReputationResult> {
  const started = Date.now();

  const domain = extractDomain(input.finalUrl);
  if (!domain) {
    return emptyResult(started);
  }

  const [registration, dns, reverseDns, asnInfo, externalProviders] = await Promise.all([
    lookupDomainRegistration(domain),
    collectDnsRecords(domain),
    lookupReverseDns(input.ipAddress),
    lookupAsn(input.ipAddress),
    runExternalReputationProviders({ domain, url: input.finalUrl }),
  ]);

  const dnsHealth = await analyzeDnsHealth(domain, dns);

  const infrastructure = {
    nameservers: dns.ns,
    asn: asnInfo.asn,
    asnOrganization: asnInfo.organization,
    hostingProvider: asnInfo.organization ?? input.ipAddress,
    reverseDns,
  };

  const localMatches = buildDomainRiskMatches({
    domain,
    registration,
    dns,
    dnsHealth,
    infrastructure,
    redirectSuspicious: input.redirectSuspicious,
    redirectNotes: input.redirectNotes,
    pageTitle: input.pageTitle,
  });

  const externalMatches = providerMatches(externalProviders);
  const matches = [...localMatches, ...externalMatches];

  const riskReasons = collectRiskReasons(matches);
  const reputationScore = calculateReputationScore({
    matches,
    dnsHealth,
    externalProviders,
    registrationAvailable: registration.whoisAvailable,
  });
  const trustLevel = deriveTrustLevel(reputationScore);
  const summary = buildReputationSummary({
    domain,
    reputationScore,
    trustLevel,
    riskReasons,
    registrar: registration.registrar,
    ageDays: registration.ageDays,
  });

  return {
    domain,
    registration,
    dns,
    dnsHealth,
    infrastructure,
    reputationScore,
    trustLevel,
    riskReasons,
    summary,
    externalProviders,
    matches,
    checksCompleted: CHECKS_TOTAL,
    checksTotal: CHECKS_TOTAL,
    durationMs: Date.now() - started,
  };
}

function emptyResult(started: number): DomainReputationResult {
  return {
    domain: "",
    registration: {
      whoisAvailable: false,
      registrar: null,
      createdDate: null,
      expiresDate: null,
      ageDays: null,
      source: "unavailable",
    },
    dns: { a: [], aaaa: [], mx: [], txt: [], cname: [], ns: [] },
    dnsHealth: {
      level: "broken",
      hasSpf: false,
      hasDmarc: false,
      dkimDetected: false,
      issues: [],
    },
    infrastructure: {
      nameservers: [],
      asn: null,
      asnOrganization: null,
      hostingProvider: null,
      reverseDns: null,
    },
    reputationScore: 0,
    trustLevel: "poor",
    riskReasons: [],
    summary: "Domain reputation analysis could not resolve a valid hostname.",
    externalProviders: [],
    matches: [],
    checksCompleted: 0,
    checksTotal: CHECKS_TOTAL,
    durationMs: Date.now() - started,
  };
}
