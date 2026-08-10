import { DOMAIN_REPUTATION_LIMITS } from "@/lib/scan/website/domain-reputation/constants";
import type { DomainRegistrationInfo } from "@/lib/scan/website/domain-reputation/types";

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}

interface RdapEntity {
  roles?: string[];
  vcardArray?: unknown[];
}

interface RdapResponse {
  events?: RdapEvent[];
  entities?: RdapEntity[];
}

function parseRdapDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function extractRegistrar(entities: RdapEntity[] | undefined): string | null {
  if (!entities) return null;

  for (const entity of entities) {
    if (!entity.roles?.includes("registrar")) continue;
    const vcard = entity.vcardArray;
    if (!Array.isArray(vcard) || vcard.length < 2) continue;

    const fields = vcard[1];
    if (!Array.isArray(fields)) continue;

    for (const field of fields) {
      if (Array.isArray(field) && field[0] === "fn") {
        const name = field[3];
        if (typeof name === "string" && name.trim()) {
          return name.trim();
        }
      }
    }
  }

  return null;
}

export async function lookupDomainRegistration(domain: string): Promise<DomainRegistrationInfo> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOMAIN_REPUTATION_LIMITS.rdapTimeoutMs);

  try {
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/rdap+json, application/json",
      },
    });

    if (!response.ok) {
      return {
        whoisAvailable: false,
        registrar: null,
        createdDate: null,
        expiresDate: null,
        ageDays: null,
        source: "unavailable",
      };
    }

    const data = (await response.json()) as RdapResponse;
    const events = data.events ?? [];

    const createdDate = parseRdapDate(
      events.find((event) => event.eventAction === "registration")?.eventDate,
    );
    const expiresDate = parseRdapDate(
      events.find((event) => event.eventAction === "expiration")?.eventDate,
    );

    let ageDays: number | null = null;
    if (createdDate) {
      ageDays = daysBetween(new Date(createdDate), new Date());
    }

    return {
      whoisAvailable: true,
      registrar: extractRegistrar(data.entities),
      createdDate,
      expiresDate,
      ageDays,
      source: "rdap",
    };
  } catch {
    return {
      whoisAvailable: false,
      registrar: null,
      createdDate: null,
      expiresDate: null,
      ageDays: null,
      source: "unavailable",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function isNewlyRegistered(ageDays: number | null): boolean {
  if (ageDays === null) return false;
  return ageDays >= 0 && ageDays <= DOMAIN_REPUTATION_LIMITS.newlyRegisteredDays;
}

export function isExpiringSoon(expiresDate: string | null): boolean {
  if (!expiresDate) return false;
  const expires = new Date(expiresDate);
  if (Number.isNaN(expires.getTime())) return false;
  const days = daysBetween(new Date(), expires);
  return days >= 0 && days <= DOMAIN_REPUTATION_LIMITS.expiringSoonDays;
}
