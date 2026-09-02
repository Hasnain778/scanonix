/**
 * Phase 130D-2B — subscription_complete poll fallback verification.
 * Run: npx --yes tsx scripts/verify-analytics-130d-2b-subscription-fallback.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CUSTOM_EVENT_NAMES,
  EVENT_PARAMETER_ALLOWLIST,
  FORBIDDEN_PARAMETER_NAMES,
  sanitizeCustomEvent,
} from "../lib/analytics/events";
import { ANALYTICS_SOURCE_SURFACE_UNKNOWN } from "../lib/analytics/surfaces";

const root = process.cwd();

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`✓ ${name}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

console.log("Phase 130D-2B — subscription fallback analytics verification\n");

const billingSuccess = readSource("components/billing/BillingSuccessClient.tsx");
const subscriptionComplete = readSource("lib/analytics/subscription-complete.ts");
const statusRoute = readSource("app/api/billing/status/route.ts");
const plansSource = readSource("lib/stripe/plans.ts");
const ga4Source = readSource("lib/analytics/ga4.ts");
const providerSource = readSource("components/analytics/AnalyticsProvider.tsx");
const consentSource = readSource("lib/analytics/consent.ts");

// A/B: both paths share helper
assert(
  "A sync path calls attemptSubscriptionComplete",
  /syncResponse\.ok[\s\S]*attemptSubscriptionComplete\(/.test(billingSuccess),
);
assert(
  "B poll path calls attemptSubscriptionComplete after status",
  /api\/billing\/status[\s\S]*attemptSubscriptionComplete\(/.test(billingSuccess),
);
assert(
  "A/B both reuse tryTrackSubscriptionComplete",
  billingSuccess.includes("tryTrackSubscriptionComplete") &&
    subscriptionComplete.includes('trackEvent("subscription_complete"'),
);

// C/D/E: single attempt claim
assert(
  "C/D/E attemptSubscriptionComplete claims ref before track",
  /function attemptSubscriptionComplete[\s\S]*if \(subscriptionCompleteTrackedRef\.current\)[\s\S]*subscriptionCompleteTrackedRef\.current = true[\s\S]*tryTrackSubscriptionComplete/.test(
    billingSuccess,
  ),
);
assert(
  "C sync early-return prevents continuing into poll after paid sync",
  /attemptSubscriptionComplete\([\s\S]*setConfirmedPlan\(syncData\.plan\)[\s\S]*return;/.test(
    billingSuccess,
  ),
);
assert(
  "D poll loop returns after first paid confirmation",
  /attemptSubscriptionComplete\([\s\S]*setConfirmedPlan\(data\.plan\)[\s\S]*return;/.test(
    billingSuccess,
  ),
);

// F: persisted/tab dedupe unchanged
assert(
  "F tab dedupe key preserved",
  subscriptionComplete.includes("scanonix_ga_subscription_complete_tab_v1"),
);
assert(
  "F localStorage dedupe key preserved",
  subscriptionComplete.includes("scanonix_ga_subscription_complete_v1"),
);
assert(
  "F dedupe persisted only after sent",
  subscriptionComplete.includes('if (result === "sent")') &&
    subscriptionComplete.indexOf("localStorage.setItem") >
      subscriptionComplete.indexOf('if (result === "sent")'),
);

// G: unpaid does not emit
assert(
  "G poll requires isPaidPlan / hasActiveSubscription",
  /hasActiveSubscription && isPaidPlan\(data\.plan\)/.test(billingSuccess),
);
assert(
  "G unpaid free plan not tracked on poll",
  !/plan !== "free"[\s\S]*attemptSubscriptionComplete/.test(billingSuccess),
);
assert(
  "G missing billing_interval skips trackEvent call",
  /if \(!input\.billing_interval\)[\s\S]*return;/.test(billingSuccess),
);

// H: consent gate unchanged via tryTrack → trackEvent
assert(
  "H tryTrack uses trackEvent (consent-gated)",
  subscriptionComplete.includes('trackEvent("subscription_complete"'),
);
assert(
  "H ga4 still requires isAnalyticsConsentGranted",
  ga4Source.includes("isAnalyticsConsentGranted()"),
);
assert(
  "H consent storage key unchanged",
  consentSource.includes("scanonix_consent_v1"),
);

// I: no Stripe identifiers in analytics payload path
assert(
  "I poll source_surface is unknown constant",
  billingSuccess.includes("ANALYTICS_SOURCE_SURFACE_UNKNOWN") &&
    /attemptSubscriptionComplete\([\s\S]*source_surface: ANALYTICS_SOURCE_SURFACE_UNKNOWN/.test(
      billingSuccess,
    ),
);
assert(
  "I BillingSuccessClient analytics calls omit Stripe identifiers",
  !billingSuccess.includes("stripeCustomerId") &&
    !billingSuccess.includes("stripe_customer_id") &&
    !billingSuccess.includes("stripe_subscription_id") &&
    !/attemptSubscriptionComplete\(\{[^}]*sessionId/.test(billingSuccess),
);
assert(
  "I status route billing_interval is not a Stripe id field name",
  statusRoute.includes("billing_interval:") &&
    !/billing_interval:\s*profile\?\.stripe/.test(statusRoute),
);
assert(
  "I session_id still forbidden in custom event schema",
  (FORBIDDEN_PARAMETER_NAMES as readonly string[]).includes("session_id"),
);

// J: schema reused
assert("J subscription_complete still event name", CUSTOM_EVENT_NAMES.includes("subscription_complete"));
assert(
  "J parameter allowlist unchanged",
  EVENT_PARAMETER_ALLOWLIST.subscription_complete.join(",") ===
    "tier,billing_interval,source_surface",
);
const sample = sanitizeCustomEvent("subscription_complete", {
  tier: "pro",
  billing_interval: "month",
  source_surface: ANALYTICS_SOURCE_SURFACE_UNKNOWN,
});
assert("J unknown surface accepted for poll attribution", sample.ok === true);

// Metadata helpers
assert(
  "status returns billing_interval from trusted price map",
  statusRoute.includes("mapPriceIdToBillingInterval") &&
    statusRoute.includes("billingIntervalToAnalytics"),
);
assert(
  "mapPriceIdToBillingInterval exists in plans",
  plansSource.includes("export function mapPriceIdToBillingInterval"),
);

// K: 130D-2A page_view privacy intact
assert(
  "K sanitizeGaPagePath present",
  ga4Source.includes("export function sanitizeGaPagePath"),
);
assert(
  "K sanitizeGaPageLocation present",
  ga4Source.includes("export function sanitizeGaPageLocation"),
);
assert(
  "K page_view not using raw window.location.href",
  !ga4Source.includes("page_location: window.location.href"),
);
assert(
  "K AnalyticsProvider pathname-only",
  providerSource.includes("trackPageView(pathname)") &&
    !providerSource.includes("useSearchParams"),
);
assert(
  "K 130D-2A verifier still present",
  existsSync(join(root, "scripts/verify-analytics-130d-2a-page-view-privacy.ts")),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
