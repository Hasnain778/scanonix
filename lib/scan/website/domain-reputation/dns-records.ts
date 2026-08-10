import {
  resolve4,
  resolve6,
  resolveCname,
  resolveMx,
  resolveNs,
  resolveTxt,
  reverse,
} from "node:dns/promises";
import { DOMAIN_REPUTATION_LIMITS } from "@/lib/scan/website/domain-reputation/constants";
import type { DomainDnsRecords } from "@/lib/scan/website/domain-reputation/types";

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function collectDnsRecords(domain: string): Promise<DomainDnsRecords> {
  const timeout = DOMAIN_REPUTATION_LIMITS.dnsTimeoutMs;

  const [a, aaaa, mx, txt, cname, ns] = await Promise.all([
    withTimeout(resolve4(domain), timeout),
    withTimeout(resolve6(domain), timeout),
    withTimeout(resolveMx(domain), timeout),
    withTimeout(resolveTxt(domain), timeout),
    withTimeout(resolveCname(domain), timeout),
    withTimeout(resolveNs(domain), timeout),
  ]);

  return {
    a: a ?? [],
    aaaa: aaaa ?? [],
    mx: (mx ?? []).map((entry) => `${entry.priority} ${entry.exchange}`),
    txt: (txt ?? [])
      .flat()
      .slice(0, DOMAIN_REPUTATION_LIMITS.maxTxtRecords),
    cname: cname ?? [],
    ns: ns ?? [],
  };
}

export async function lookupReverseDns(ipAddress: string | null): Promise<string | null> {
  if (!ipAddress) return null;

  const result = await withTimeout(reverse(ipAddress), DOMAIN_REPUTATION_LIMITS.dnsTimeoutMs);
  if (!result || result.length === 0) return null;
  return result[0] ?? null;
}

export async function lookupAsn(ipAddress: string | null): Promise<{
  asn: string | null;
  organization: string | null;
}> {
  if (!ipAddress) {
    return { asn: null, organization: null };
  }

  const parts = ipAddress.split(".");
  if (parts.length !== 4) {
    return { asn: null, organization: null };
  }

  const query = `${parts.reverse().join(".")}.origin.asn.cymru.com`;
  const txt = await withTimeout(resolveTxt(query), DOMAIN_REPUTATION_LIMITS.dnsTimeoutMs);
  if (!txt || txt.length === 0) {
    return { asn: null, organization: null };
  }

  const line = txt.flat()[0] ?? "";
  const segments = line.split("|").map((part) => part.trim());
  if (segments.length < 5) {
    return { asn: segments[0] ? `AS${segments[0]}` : null, organization: null };
  }

  return {
    asn: segments[0] ? `AS${segments[0]}` : null,
    organization: segments[4] || null,
  };
}
