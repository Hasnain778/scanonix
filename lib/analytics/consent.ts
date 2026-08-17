/**
 * First-party analytics consent preference storage (Phase 130B).
 * Stores preference only — no analytics scripts, IDs, or tracking data.
 */

import { clearGaCookies, disableAnalyticsTracking, enableAnalyticsTracking } from "@/lib/analytics/ga4";

export const CONSENT_STORAGE_KEY = "scanonix_consent_v1";
export const CONSENT_VERSION = 1;
export const CONSENT_CHANGE_EVENT = "scanonix-consent-change";

export interface ConsentState {
  analytics: boolean;
  decidedAt: string;
  version: number;
}

export type ConsentDecision = "undecided" | "accepted" | "rejected";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function parseStoredConsent(raw: string): ConsentState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.version !== CONSENT_VERSION) return null;
    if (typeof parsed.analytics !== "boolean") return null;
    if (typeof parsed.decidedAt !== "string" || !parsed.decidedAt) return null;
    return {
      analytics: parsed.analytics,
      decidedAt: parsed.decidedAt,
      version: CONSENT_VERSION,
    };
  } catch {
    return null;
  }
}

/** Read stored consent. Returns null on SSR or when undecided / invalid. */
export function readStoredConsent(): ConsentState | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
  if (!raw) return null;
  return parseStoredConsent(raw);
}

export function getConsentDecision(): ConsentDecision {
  const stored = readStoredConsent();
  if (!stored) return "undecided";
  return stored.analytics ? "accepted" : "rejected";
}

export function isConsentUndecided(): boolean {
  return getConsentDecision() === "undecided";
}

export function isAnalyticsConsentGranted(): boolean {
  return readStoredConsent()?.analytics === true;
}

function dispatchConsentChange(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT));
}

function writeConsent(analytics: boolean): ConsentState {
  const state: ConsentState = {
    analytics,
    decidedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };

  if (isBrowser()) {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
    dispatchConsentChange();
  }

  return state;
}

export function acceptAnalyticsConsent(): ConsentState {
  enableAnalyticsTracking();
  return writeConsent(true);
}

export function rejectAnalyticsConsent(): ConsentState {
  disableAnalyticsTracking();
  const state = writeConsent(false);
  clearGaCookies();
  return state;
}

/** Withdraw analytics consent (alias for reject — immediate effect). */
export function withdrawAnalyticsConsent(): ConsentState {
  return rejectAnalyticsConsent();
}

/** Remove stored consent so the banner reappears (testing / version resets). */
export function resetAnalyticsConsent(): void {
  if (!isBrowser()) return;
  disableAnalyticsTracking();
  localStorage.removeItem(CONSENT_STORAGE_KEY);
  clearGaCookies();
  dispatchConsentChange();
}

/** Clears GA cookies and disables tracking. Preserves scanonix_consent_v1 unless reset. */
export function clearAnalyticsCookies(): void {
  if (!isBrowser()) return;
  disableAnalyticsTracking();
  clearGaCookies();
}
