/** Domain reputation analysis limits. */
export const DOMAIN_REPUTATION_LIMITS = {
  dnsTimeoutMs: 5_000,
  rdapTimeoutMs: 6_000,
  providerTimeoutMs: 5_000,
  maxTxtRecords: 30,
  maxMxRecords: 20,
  newlyRegisteredDays: 90,
  expiringSoonDays: 30,
} as const;

/** TLDs commonly associated with abuse (substring match on hostname). */
export const SUSPICIOUS_TLD_PATTERNS = [
  ".zip",
  ".mov",
  ".click",
  ".top",
  ".xyz",
  ".icu",
  ".cam",
  ".work",
  ".gq",
  ".ml",
  ".tk",
  ".cf",
  ".ga",
  ".loan",
  ".review",
  ".country",
  ".stream",
] as const;

/** Known disposable / throwaway domain suffixes (local list — not exhaustive). */
export const DISPOSABLE_DOMAIN_PATTERNS = [
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "yopmail.com",
  "throwaway.email",
  "getnada.com",
  "sharklasers.com",
  "trashmail.com",
] as const;

/** Nameserver / parking indicators. */
export const PARKED_NAMESERVER_PATTERNS = [
  "sedoparking",
  "domaincontrol.com",
  "parkingcrew",
  "bodis.com",
  "above.com",
  "hugedomains",
  "namecheap parking",
  "parked",
] as const;

export type DomainReputationCategory =
  | "domain-reputation"
  | "dns-health"
  | "registration"
  | "email-auth";

export type TrustLevel = "high" | "moderate" | "low" | "poor";

export type DnsHealthLevel = "healthy" | "degraded" | "broken";
