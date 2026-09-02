/**
 * Phase 130E / 130D-2B — subscription_complete client analytics.
 * Fired after sync-session OR poll-confirmed paid status via the same helper.
 * Fire-and-forget; never affects billing. Dedupe persisted only after consent + sent.
 */

import type { BillingIntervalValue } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/ga4";
import { parseCheckoutSourceSurface } from "@/lib/analytics/checkout-metadata";
import type { BillingPlan } from "@/types/auth";

const TAB_DEDUPE_KEY = "scanonix_ga_subscription_complete_tab_v1";
const PERSISTED_DEDUPE_KEY = "scanonix_ga_subscription_complete_v1";

export interface SubscriptionCompleteTrackInput {
  tier: BillingPlan;
  billing_interval: BillingIntervalValue;
  source_surface: string;
  /** ISO period boundary for local dedupe only — never sent to GA4. */
  subscriptionPeriodEnd: string | null;
}

interface PersistedDedupeRecord {
  tier: BillingPlan;
  billing_interval: BillingIntervalValue;
  subscription_period_end: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readPersistedDedupe(): PersistedDedupeRecord | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(PERSISTED_DEDUPE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedDedupeRecord>;
    if (
      (parsed.tier !== "pro" && parsed.tier !== "business") ||
      (parsed.billing_interval !== "month" && parsed.billing_interval !== "year") ||
      typeof parsed.subscription_period_end !== "string" ||
      !parsed.subscription_period_end
    ) {
      return null;
    }
    return parsed as PersistedDedupeRecord;
  } catch {
    return null;
  }
}

function matchesPersistedDedupe(input: SubscriptionCompleteTrackInput): boolean {
  if (!input.subscriptionPeriodEnd) {
    return false;
  }
  const record = readPersistedDedupe();
  if (!record) {
    return false;
  }
  return (
    record.tier === input.tier &&
    record.billing_interval === input.billing_interval &&
    record.subscription_period_end === input.subscriptionPeriodEnd
  );
}

/**
 * Attempts one subscription_complete event after server-confirmed paid status
 * (sync-session or billing-status poll). Drops without persisting dedupe state
 * when consent/GA is unavailable.
 */
export function tryTrackSubscriptionComplete(
  input: SubscriptionCompleteTrackInput,
): "sent" | "dropped" | "skipped_dedupe" {
  try {
    if (!isBrowser()) {
      return "dropped";
    }
    if (input.tier !== "pro" && input.tier !== "business") {
      return "dropped";
    }
    if (sessionStorage.getItem(TAB_DEDUPE_KEY) === "1") {
      return "skipped_dedupe";
    }
    if (matchesPersistedDedupe(input)) {
      return "skipped_dedupe";
    }

    const source_surface = parseCheckoutSourceSurface(input.source_surface);

    const result = trackEvent("subscription_complete", {
      tier: input.tier,
      billing_interval: input.billing_interval,
      source_surface,
    });

    if (result === "sent") {
      sessionStorage.setItem(TAB_DEDUPE_KEY, "1");
      if (input.subscriptionPeriodEnd) {
        const record: PersistedDedupeRecord = {
          tier: input.tier,
          billing_interval: input.billing_interval,
          subscription_period_end: input.subscriptionPeriodEnd,
        };
        localStorage.setItem(PERSISTED_DEDUPE_KEY, JSON.stringify(record));
      }
    }

    return result;
  } catch {
    return "dropped";
  }
}
