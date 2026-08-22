import {
  ANALYTICS_SOURCE_SURFACE_UNKNOWN,
  ANALYTICS_SURFACES,
  type AnalyticsSurface,
} from "@/lib/analytics/surfaces";
import type { BillingIntervalValue } from "@/lib/analytics/events";
import type { BillingInterval } from "@/types/auth";

const APPROVED_CHECKOUT_SURFACES = new Set<string>(Object.values(ANALYTICS_SURFACES));

/** Bounded checkout source_surface for Stripe session metadata (server-side). */
export function parseCheckoutSourceSurface(value: unknown): AnalyticsSurface | "unknown" {
  if (typeof value === "string" && APPROVED_CHECKOUT_SURFACES.has(value)) {
    return value as AnalyticsSurface;
  }
  return ANALYTICS_SOURCE_SURFACE_UNKNOWN;
}

/** Normalize Stripe/checkout interval metadata to GA4 billing_interval enum. */
export function normalizeCheckoutBillingInterval(
  value: unknown,
): BillingIntervalValue | null {
  if (value === "month" || value === "monthly") {
    return "month";
  }
  if (value === "year" || value === "yearly") {
    return "year";
  }
  return null;
}

export function billingIntervalToAnalytics(interval: BillingInterval): BillingIntervalValue {
  return interval === "monthly" ? "month" : "year";
}

export function extractCheckoutAnalyticsFromSessionMetadata(
  metadata: Record<string, string> | null | undefined,
): {
  billing_interval: BillingIntervalValue;
  source_surface: AnalyticsSurface | "unknown";
} {
  const billing_interval =
    normalizeCheckoutBillingInterval(metadata?.billing_interval) ??
    normalizeCheckoutBillingInterval(metadata?.interval) ??
    "month";

  const source_surface = parseCheckoutSourceSurface(metadata?.source_surface);

  return { billing_interval, source_surface };
}
