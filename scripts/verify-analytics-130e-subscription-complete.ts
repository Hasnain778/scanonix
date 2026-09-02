/**
 * Phase 130E — subscription_complete verification.
 * Run: npm run verify:analytics-130e-subscription-complete
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  parseCheckoutSourceSurface,
  normalizeCheckoutBillingInterval,
  extractCheckoutAnalyticsFromSessionMetadata,
} from "../lib/analytics/checkout-metadata";
import {
  CUSTOM_EVENT_NAMES,
  EVENT_PARAMETER_ALLOWLIST,
  EVENT_REQUIRED_PARAMETERS,
  FORBIDDEN_PARAMETER_NAMES,
  SUBSCRIPTION_COMPLETE_TIERS,
  sanitizeCustomEvent,
} from "../lib/analytics/events";
import { FROZEN_130D_CUSTOM_EVENT_NAMES } from "../lib/analytics/surfaces";

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

function walkRuntimeSources(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkRuntimeSources(fullPath, acc);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function productRuntimeSource(): string {
  const dirs = ["app", "components", "lib"].map((dir) => join(root, dir));
  return dirs
    .flatMap((dir) => walkRuntimeSources(dir))
    .filter((path) => !path.includes(`${join("lib", "analytics")}`))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

console.log("Phase 130E — subscription_complete verification\n");

const eventsSource = readSource("lib/analytics/events.ts");
const ga4Source = readSource("lib/analytics/ga4.ts");
const subscriptionCompleteSource = readSource("lib/analytics/subscription-complete.ts");
const billingSuccessSource = readSource("components/billing/BillingSuccessClient.tsx");
const checkoutButtonSource = readSource("components/billing/CheckoutButton.tsx");
const syncSessionSource = readSource("app/api/billing/sync-session/route.ts");
const createCheckoutSource = readSource("app/api/stripe/create-checkout-session/route.ts");
const googleAnalyticsSource = readSource("components/analytics/GoogleAnalytics.tsx");
const analyticsProviderSource = readSource("components/analytics/AnalyticsProvider.tsx");
const layoutSource = readSource("app/layout.tsx");
const productRuntime = productRuntimeSource();

// 1. Event allowlist
assert("1 exactly 11 approved events", CUSTOM_EVENT_NAMES.length === 11);
assert(
  "1 130D frozen names preserved in order",
  FROZEN_130D_CUSTOM_EVENT_NAMES.every((name, index) => CUSTOM_EVENT_NAMES[index] === name),
);
assert("1 subscription_complete is event 8", CUSTOM_EVENT_NAMES[7] === "subscription_complete");
assert("1 monitor_create_start is event 9", CUSTOM_EVENT_NAMES[8] === "monitor_create_start");
assert("1 monitor_create_success is event 10", CUSTOM_EVENT_NAMES[9] === "monitor_create_success");
assert("1 monitor_create_error is event 11", CUSTOM_EVENT_NAMES[10] === "monitor_create_error");

// 2. Schema
assert(
  "2 subscription_complete schema exact",
  EVENT_REQUIRED_PARAMETERS.subscription_complete.join(",") === "tier,billing_interval,source_surface",
);
assert(
  "2 subscription_complete allowlist exact",
  EVENT_PARAMETER_ALLOWLIST.subscription_complete.join(",") === "tier,billing_interval,source_surface",
);

// 3–5. Enum constraints
const validComplete = sanitizeCustomEvent("subscription_complete", {
  tier: "pro",
  billing_interval: "month",
  source_surface: "pricing",
});
assert("3 valid subscription_complete accepted", validComplete.ok === true);

const businessComplete = sanitizeCustomEvent("subscription_complete", {
  tier: "business",
  billing_interval: "year",
  source_surface: "account_billing",
});
assert("3 business tier accepted", businessComplete.ok === true);

const freeTier = sanitizeCustomEvent("subscription_complete", {
  tier: "free",
  billing_interval: "month",
  source_surface: "pricing",
} as never);
assert("3 free tier rejected", freeTier.ok === false);

const unknownTier = sanitizeCustomEvent("subscription_complete", {
  tier: "unknown",
  billing_interval: "month",
  source_surface: "pricing",
} as never);
assert("3 unknown tier rejected", unknownTier.ok === false);

const badInterval = sanitizeCustomEvent("subscription_complete", {
  tier: "pro",
  billing_interval: "monthly",
  source_surface: "pricing",
} as never);
assert("4 monthly interval string rejected", badInterval.ok === false);

const badSurface = sanitizeCustomEvent("subscription_complete", {
  tier: "pro",
  billing_interval: "month",
  source_surface: "evil_surface",
});
assert("5 invalid source_surface rejected", badSurface.ok === false);

const unknownSurface = sanitizeCustomEvent("subscription_complete", {
  tier: "pro",
  billing_interval: "month",
  source_surface: "unknown",
});
assert("5 unknown source_surface accepted", unknownSurface.ok === true);

// 6–11. Forbidden payloads
const stripeSession = sanitizeCustomEvent("subscription_complete", {
  tier: "pro",
  billing_interval: "month",
  source_surface: "pricing",
  session_id: "cs_test_123",
} as never);
assert("6 session_id rejected", stripeSession.ok === false);

const stripeCustomer = sanitizeCustomEvent("subscription_complete", {
  tier: "pro",
  billing_interval: "month",
  source_surface: "pricing",
  stripe_customer_id: "cus_123",
} as never);
assert("6 stripe_customer_id rejected", stripeCustomer.ok === false);

const emailParam = sanitizeCustomEvent("subscription_complete", {
  tier: "pro",
  billing_interval: "month",
  source_surface: "pricing",
  email: "a@b.com",
} as never);
assert("8 email rejected", emailParam.ok === false);

const userIdParam = sanitizeCustomEvent("subscription_complete", {
  tier: "pro",
  billing_interval: "month",
  source_surface: "pricing",
  user_id: "uuid",
} as never);
assert("8 user_id rejected", userIdParam.ok === false);

const amountParam = sanitizeCustomEvent("subscription_complete", {
  tier: "pro",
  billing_interval: "month",
  source_surface: "pricing",
  amount: 999,
} as never);
assert("9 amount rejected", amountParam.ok === false);

const periodEndParam = sanitizeCustomEvent("subscription_complete", {
  tier: "pro",
  billing_interval: "month",
  source_surface: "pricing",
  period_end: "2026-01-01",
} as never);
assert("9 period_end rejected", periodEndParam.ok === false);

const urlParam = sanitizeCustomEvent("subscription_complete", {
  tier: "pro",
  billing_interval: "month",
  source_surface: "pricing",
  page_url: "https://example.com",
} as never);
assert("10 page_url rejected", urlParam.ok === false);

assert(
  "6 forbidden blocklist includes stripe ids",
  FORBIDDEN_PARAMETER_NAMES.includes("session_id") &&
    FORBIDDEN_PARAMETER_NAMES.includes("stripe_subscription_id"),
);

// 12–16. Instrumentation placement
assert(
  "12 BillingSuccessClient uses tryTrackSubscriptionComplete",
  billingSuccessSource.includes("tryTrackSubscriptionComplete"),
);
assert(
  "12 fires after sync-session HTTP success",
  /if\s*\(\s*syncResponse\.ok\s*\)[\s\S]*attemptSubscriptionComplete|if\s*\(\s*syncResponse\.ok\s*\)[\s\S]*tryTrackSubscriptionComplete/.test(
    billingSuccessSource,
  ),
);
assert(
  "13 poll-confirmed paid path also uses subscription completion helper",
  /api\/billing\/status[\s\S]*attemptSubscriptionComplete|api\/billing\/status[\s\S]*tryTrackSubscriptionComplete/.test(
    billingSuccessSource,
  ),
);
assert(
  "13 poll path uses shared attemptSubscriptionComplete helper",
  billingSuccessSource.includes("attemptSubscriptionComplete") &&
    billingSuccessSource.includes("subscriptionCompleteTrackedRef.current = true"),
);
assert(
  "14 render path has no trackEvent subscription_complete",
  !billingSuccessSource.includes('trackEvent("subscription_complete"'),
);
assert(
  "15 analytics only inside sessionId-guarded effect",
  /if\s*\(\s*!sessionId\s*\)\s*\{\s*return;\s*\}[\s\S]*(attemptSubscriptionComplete|tryTrackSubscriptionComplete)/.test(
    billingSuccessSource,
  ),
);

// 17–18. Consent / no queue
assert("17 trackEvent routed through ga4 helper", subscriptionCompleteSource.includes('trackEvent("subscription_complete"'));
assert("17 ga4 drops not queues", ga4Source.includes('"dropped"') && ga4Source.includes("never queues"));
assert(
  "18 dedupe persisted only after sent",
  subscriptionCompleteSource.includes('if (result === "sent")') &&
    subscriptionCompleteSource.indexOf("localStorage.setItem") >
      subscriptionCompleteSource.indexOf('if (result === "sent")'),
);

// 19–21. GA bootstrap / dedupe guards
assert("19 canSendCustomAnalyticsEvent exists", ga4Source.includes("canSendCustomAnalyticsEvent"));
assert("20 useRef guard in BillingSuccessClient", billingSuccessSource.includes("subscriptionCompleteTrackedRef"));
assert("21 no direct gtag outside analytics", !productRuntime.includes('gtag("event"'));

// 22–26. Frozen regressions
assert(
  "22 checkout_start unchanged trigger",
  checkoutButtonSource.includes('trackEvent("checkout_start"') &&
    checkoutButtonSource.indexOf("fetch") > checkoutButtonSource.indexOf("checkout_start"),
);
for (const event of FROZEN_130D_CUSTOM_EVENT_NAMES) {
  assert(`23 130D event preserved in allowlist: ${event}`, CUSTOM_EVENT_NAMES.includes(event));
}
assert(
  "24 page_view unchanged",
  analyticsProviderSource.includes("trackPageView") &&
    !analyticsProviderSource.includes("subscription_complete"),
);
assert(
  "25 FAV2 unchanged",
  layoutSource.includes('apple: "/icon.png"') && !layoutSource.includes('url: "/icon.png"'),
);
assert("26 no new analytics dependency", !readSource("package.json").includes("@vercel/analytics"));

// Server metadata
assert(
  "3 create-checkout-session stores billing_interval metadata",
  createCheckoutSource.includes("billing_interval:") && createCheckoutSource.includes("source_surface:"),
);
assert(
  "3 create-checkout-session validates source_surface",
  createCheckoutSource.includes("parseCheckoutSourceSurface"),
);
assert(
  "3 sync-session returns safe analytics fields",
  syncSessionSource.includes("billing_interval") &&
    syncSessionSource.includes("source_surface") &&
    syncSessionSource.includes("subscriptionPeriodEnd"),
);
assert(
  "3 sync-session response omits stripe session id field",
  syncSessionSource.includes("subscriptionPeriodEnd") &&
    !syncSessionSource.match(/session_id\s*:/i) &&
    !syncSessionSource.includes("session.id"),
);

// CheckoutButton passes source_surface
assert(
  "3 CheckoutButton sends source_surface",
  checkoutButtonSource.includes("source_surface: sourceSurface"),
);

// Simulated scenarios (schema / metadata helpers)
assert(
  "A schema accepts pro active confirmation payload",
  sanitizeCustomEvent("subscription_complete", {
    tier: "pro",
    billing_interval: "month",
    source_surface: "pricing",
  }).ok === true,
);

assert(
  "C schema accepts business payload",
  sanitizeCustomEvent("subscription_complete", {
    tier: "business",
    billing_interval: "year",
    source_surface: "pro_gate",
  }).ok === true,
);

assert(
  "D incomplete metadata interval alone still maps safely",
  normalizeCheckoutBillingInterval("monthly") === "month",
);

assert(
  "H invalid source_surface falls back to unknown server-side",
  parseCheckoutSourceSurface("not_a_real_surface") === "unknown",
);

assert(
  "H extract metadata uses unknown for bad surface",
  extractCheckoutAnalyticsFromSessionMetadata({
    interval: "yearly",
    source_surface: "bad",
  }).source_surface === "unknown",
);

// Dedupe structure
assert(
  "B duplicate protection uses sessionStorage tab key",
  subscriptionCompleteSource.includes("scanonix_ga_subscription_complete_tab_v1"),
);
assert(
  "B duplicate protection uses localStorage persisted dedupe",
  subscriptionCompleteSource.includes("scanonix_ga_subscription_complete_v1"),
);
assert(
  "G no replay queue in subscription-complete module",
  !subscriptionCompleteSource.match(/queue|replay|retry.*trackEvent/i),
);

// Tier allowlist export
assert(
  "3 subscription_complete tiers constrained",
  SUBSCRIPTION_COMPLETE_TIERS.join(",") === "pro,business",
);

// Package script
assert(
  "verify script registered",
  readSource("package.json").includes("verify:analytics-130e-subscription-complete"),
);

console.log(`\n130E subscription_complete verify: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
