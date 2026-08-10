import { resolveTxt } from "node:dns/promises";
import { DOMAIN_REPUTATION_LIMITS } from "@/lib/scan/website/domain-reputation/constants";
import type { DomainDnsHealth, DomainDnsRecords } from "@/lib/scan/website/domain-reputation/types";

function txtIncludes(record: string, pattern: RegExp): boolean {
  return pattern.test(record);
}

export async function analyzeDnsHealth(
  domain: string,
  records: DomainDnsRecords,
): Promise<DomainDnsHealth> {
  const issues: string[] = [];
  const allTxt = [...records.txt];

  let dmarcRecords: string[] = [];
  try {
    const dmarcTxt = await Promise.race([
      resolveTxt(`_dmarc.${domain}`),
      new Promise<string[][]>((resolve) =>
        setTimeout(() => resolve([]), DOMAIN_REPUTATION_LIMITS.dnsTimeoutMs),
      ),
    ]);
    dmarcRecords = dmarcTxt.flat();
    allTxt.push(...dmarcRecords);
  } catch {
    // DMARC subdomain may not exist
  }

  const hasSpf = allTxt.some((record) => txtIncludes(record, /^v=spf1/i));
  const hasDmarc = dmarcRecords.some((record) => txtIncludes(record, /^v=DMARC1/i));
  const dkimDetected = allTxt.some((record) => txtIncludes(record, /^v=DKIM1/i));

  if (records.a.length === 0 && records.aaaa.length === 0 && records.cname.length === 0) {
    issues.push("No A, AAAA, or CNAME records resolved — DNS may be broken.");
  }

  if (records.ns.length === 0) {
    issues.push("No NS records returned for the domain.");
  }

  if (records.mx.length === 0) {
    issues.push("No MX records found (expected if the domain does not send email).");
  }

  if (!hasSpf && records.mx.length > 0) {
    issues.push("SPF record (v=spf1) not detected while MX records are present.");
  }

  if (!hasDmarc && records.mx.length > 0) {
    issues.push("DMARC record (v=DMARC1) not detected at _dmarc subdomain.");
  }

  if (!dkimDetected && records.mx.length > 0) {
    issues.push("DKIM (v=DKIM1) not detected in public TXT records.");
  }

  const broken = records.a.length === 0 && records.aaaa.length === 0 && records.cname.length === 0;
  const degraded = issues.some((issue) => issue.includes("SPF") || issue.includes("DMARC") || issue.includes("NS"));

  return {
    level: broken ? "broken" : degraded ? "degraded" : "healthy",
    hasSpf,
    hasDmarc,
    dkimDetected,
    issues,
  };
}
