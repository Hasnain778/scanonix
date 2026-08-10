import type {
  DnsHealthLevel,
  TrustLevel,
} from "@/lib/scan/website/domain-reputation/constants";

export interface DomainRegistrationInfo {
  whoisAvailable: boolean;
  registrar: string | null;
  createdDate: string | null;
  expiresDate: string | null;
  ageDays: number | null;
  source: "rdap" | "unavailable";
}

export interface DomainDnsRecords {
  a: string[];
  aaaa: string[];
  mx: string[];
  txt: string[];
  cname: string[];
  ns: string[];
}

export interface DomainDnsHealth {
  level: DnsHealthLevel;
  hasSpf: boolean;
  hasDmarc: boolean;
  dkimDetected: boolean;
  issues: string[];
}

export interface DomainInfrastructureInfo {
  nameservers: string[];
  asn: string | null;
  asnOrganization: string | null;
  hostingProvider: string | null;
  reverseDns: string | null;
}

export interface ExternalProviderResult {
  provider: string;
  configured: boolean;
  result: "clean" | "suspicious" | "unknown" | "skipped";
  detail: string | null;
}

export interface DomainReputationMatch {
  id: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  whyItMatters: string;
  evidence: string;
  recommendation: string;
  confidence: "high" | "medium" | "low";
  affectedResource: string;
  fixDifficulty?: "easy" | "moderate" | "hard";
}

export interface DomainReputationResult {
  domain: string;
  registration: DomainRegistrationInfo;
  dns: DomainDnsRecords;
  dnsHealth: DomainDnsHealth;
  infrastructure: DomainInfrastructureInfo;
  reputationScore: number;
  trustLevel: TrustLevel;
  riskReasons: string[];
  summary: string;
  externalProviders: ExternalProviderResult[];
  matches: DomainReputationMatch[];
  checksCompleted: number;
  checksTotal: number;
  durationMs: number;
}

export interface DomainReputationInput {
  finalUrl: string;
  ipAddress: string | null;
  redirectSuspicious: boolean;
  redirectNotes: string[];
  pageTitle: string | null;
  budgetStartedAt: number;
}
