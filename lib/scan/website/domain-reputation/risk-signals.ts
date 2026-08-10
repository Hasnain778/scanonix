import {
  DISPOSABLE_DOMAIN_PATTERNS,
  DOMAIN_REPUTATION_LIMITS,
  PARKED_NAMESERVER_PATTERNS,
  SUSPICIOUS_TLD_PATTERNS,
} from "@/lib/scan/website/domain-reputation/constants";
import { isExpiringSoon, isNewlyRegistered } from "@/lib/scan/website/domain-reputation/rdap";
import type {
  DomainDnsHealth,
  DomainDnsRecords,
  DomainInfrastructureInfo,
  DomainRegistrationInfo,
  DomainReputationMatch,
} from "@/lib/scan/website/domain-reputation/types";

function hostnameFromDomain(domain: string): string {
  return domain.toLowerCase();
}

export function isSuspiciousTld(domain: string): boolean {
  const lower = hostnameFromDomain(domain);
  return SUSPICIOUS_TLD_PATTERNS.some((tld) => lower.endsWith(tld));
}

export function isDisposableDomain(domain: string): boolean {
  const lower = hostnameFromDomain(domain);
  return DISPOSABLE_DOMAIN_PATTERNS.some(
    (pattern) => lower === pattern || lower.endsWith(`.${pattern}`),
  );
}

export function isParkedDomain(params: {
  nameservers: string[];
  pageTitle: string | null;
}): boolean {
  const nsJoined = params.nameservers.join(" ").toLowerCase();
  if (PARKED_NAMESERVER_PATTERNS.some((pattern) => nsJoined.includes(pattern))) {
    return true;
  }

  const title = (params.pageTitle ?? "").toLowerCase();
  return (
    title.includes("domain is for sale") ||
    title.includes("parked") ||
    title.includes("coming soon") ||
    title.includes("buy this domain")
  );
}

export function buildDomainRiskMatches(params: {
  domain: string;
  registration: DomainRegistrationInfo;
  dns: DomainDnsRecords;
  dnsHealth: DomainDnsHealth;
  infrastructure: DomainInfrastructureInfo;
  redirectSuspicious: boolean;
  redirectNotes: string[];
  pageTitle: string | null;
}): DomainReputationMatch[] {
  const matches: DomainReputationMatch[] = [];
  const { domain, registration, dns, dnsHealth, infrastructure } = params;

  if (isNewlyRegistered(registration.ageDays)) {
    matches.push({
      id: "domain-rep-newly-registered",
      category: "registration",
      severity: "medium",
      title: "Newly registered domain",
      description: `Domain was registered approximately ${registration.ageDays} days ago.`,
      whyItMatters:
        "Recently registered domains are frequently used for phishing, scams, and short-lived malicious campaigns.",
      evidence: registration.createdDate ?? `Age: ${registration.ageDays} days`,
      recommendation:
        "Verify domain ownership and business legitimacy before trusting sensitive interactions.",
      confidence: registration.source === "rdap" ? "high" : "medium",
      affectedResource: domain,
      fixDifficulty: "easy",
    });
  }

  if (isExpiringSoon(registration.expiresDate)) {
    matches.push({
      id: "domain-rep-expiring-soon",
      category: "registration",
      severity: "low",
      title: "Domain registration expiring soon",
      description: "WHOIS/RDAP indicates the domain registration expires within 30 days.",
      whyItMatters:
        "Expired domains can be re-registered by attackers and used for impersonation or malware delivery.",
      evidence: registration.expiresDate ?? "Expiration within 30 days",
      recommendation: "Renew domain registration promptly and enable auto-renewal with the registrar.",
      confidence: registration.source === "rdap" ? "high" : "medium",
      affectedResource: domain,
      fixDifficulty: "easy",
    });
  }

  if (isSuspiciousTld(domain)) {
    matches.push({
      id: "domain-rep-suspicious-tld",
      category: "domain-reputation",
      severity: "medium",
      title: "Suspicious top-level domain",
      description: "The domain uses a TLD commonly associated with abuse or low-trust sites.",
      whyItMatters:
        "Certain TLDs appear disproportionately in phishing and spam campaigns, warranting extra scrutiny.",
      evidence: domain,
      recommendation: "Validate sender identity and avoid entering credentials unless trust is established.",
      confidence: "medium",
      affectedResource: domain,
      fixDifficulty: "easy",
    });
  }

  if (isDisposableDomain(domain)) {
    matches.push({
      id: "domain-rep-disposable",
      category: "domain-reputation",
      severity: "high",
      title: "Disposable domain pattern detected",
      description: "The domain matches known disposable or throwaway email domain patterns.",
      whyItMatters:
        "Disposable domains are designed for anonymity and are unsuitable for trusted business operations.",
      evidence: domain,
      recommendation: "Do not treat this domain as a long-term trusted business identity.",
      confidence: "high",
      affectedResource: domain,
      fixDifficulty: "easy",
    });
  }

  if (dnsHealth.level === "broken") {
    matches.push({
      id: "domain-rep-broken-dns",
      category: "dns-health",
      severity: "high",
      title: "Broken DNS configuration",
      description: "No address records (A/AAAA/CNAME) resolved for the domain.",
      whyItMatters:
        "Broken DNS can indicate misconfiguration, expired hosting, or domains prepared for rapid rotation.",
      evidence: dnsHealth.issues.join("; "),
      recommendation: "Verify DNS hosting configuration and nameserver delegation.",
      confidence: "high",
      affectedResource: domain,
      fixDifficulty: "moderate",
    });
  }

  if (dns.mx.length > 0 && !dnsHealth.hasSpf) {
    matches.push({
      id: "domain-rep-missing-spf",
      category: "email-auth",
      severity: "medium",
      title: "Missing SPF record",
      description: "MX records exist but no SPF (v=spf1) TXT record was detected.",
      whyItMatters:
        "Without SPF, attackers can more easily spoof email appearing to originate from this domain.",
      evidence: `MX: ${dns.mx.slice(0, 3).join(", ")}`,
      recommendation: "Publish an SPF TXT record authorising legitimate mail senders.",
      confidence: "high",
      affectedResource: domain,
      fixDifficulty: "moderate",
    });
  }

  if (dns.mx.length > 0 && !dnsHealth.hasDmarc) {
    matches.push({
      id: "domain-rep-missing-dmarc",
      category: "email-auth",
      severity: "medium",
      title: "Missing DMARC record",
      description: "No DMARC policy (v=DMARC1) was found at _dmarc subdomain.",
      whyItMatters:
        "DMARC helps prevent email spoofing and provides reporting on authentication failures.",
      evidence: `_dmarc.${domain}`,
      recommendation: "Add a DMARC TXT record starting with v=DMARC1 at _dmarc subdomain.",
      confidence: "high",
      affectedResource: domain,
      fixDifficulty: "moderate",
    });
  }

  if (dns.mx.length > 0 && !dnsHealth.dkimDetected) {
    matches.push({
      id: "domain-rep-missing-dkim",
      category: "email-auth",
      severity: "low",
      title: "DKIM not detected in public DNS",
      description: "No v=DKIM1 TXT record was found in commonly queried DNS records.",
      whyItMatters:
        "DKIM signing helps recipients verify email integrity; absence increases spoofing risk.",
      evidence: "No v=DKIM1 in TXT records",
      recommendation:
        "Configure DKIM with your mail provider and publish selector TXT records.",
      confidence: "medium",
      affectedResource: domain,
      fixDifficulty: "moderate",
    });
  }

  if (isParkedDomain({ nameservers: infrastructure.nameservers, pageTitle: params.pageTitle })) {
    matches.push({
      id: "domain-rep-parked",
      category: "domain-reputation",
      severity: "low",
      title: "Parked or placeholder domain indicators",
      description: "Nameserver or page title patterns suggest a parked or placeholder domain.",
      whyItMatters:
        "Parked domains may later be sold or repurposed for malicious campaigns without warning.",
      evidence: infrastructure.nameservers.slice(0, 3).join(", ") || params.pageTitle || domain,
      recommendation: "Treat parked domains as untrusted until active legitimate content is verified.",
      confidence: "medium",
      affectedResource: domain,
      fixDifficulty: "easy",
    });
  }

  if (params.redirectSuspicious) {
    matches.push({
      id: "domain-rep-suspicious-redirect",
      category: "domain-reputation",
      severity: "medium",
      title: "Suspicious redirect chain",
      description: "Cross-domain or unusual redirects were observed during HTTP collection.",
      whyItMatters:
        "Redirect chains across unrelated domains are used in phishing and cloaking attacks.",
      evidence: params.redirectNotes.join("; ") || "Cross-domain redirect detected",
      recommendation: "Review redirect configuration and ensure final destination matches expected domain.",
      confidence: "high",
      affectedResource: domain,
      fixDifficulty: "moderate",
    });
  }

  if (
    registration.ageDays !== null &&
    registration.ageDays > DOMAIN_REPUTATION_LIMITS.newlyRegisteredDays &&
    registration.source === "rdap"
  ) {
    void registration.registrar;
  }

  return matches;
}

export function collectRiskReasons(matches: DomainReputationMatch[]): string[] {
  return matches.map((match) => match.title);
}
