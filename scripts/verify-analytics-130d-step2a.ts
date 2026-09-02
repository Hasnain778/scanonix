/**
 * Phase 130D Step 2A — custom event foundation verification.
 * Run: npm run verify:analytics-130d-step2a
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  CUSTOM_EVENT_NAMES,
  EVENT_PARAMETER_ALLOWLIST,
  FORBIDDEN_PARAMETER_NAMES,
  sanitizeCustomEvent,
  type ToolProcessErrorParams,
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

console.log("Phase 130D Step 2A — custom event foundation verification\n");

const eventsSource = readSource("lib/analytics/events.ts");
const ga4Source = readSource("lib/analytics/ga4.ts");
const googleAnalyticsSource = readSource("components/analytics/GoogleAnalytics.tsx");
const analyticsProviderSource = readSource("components/analytics/AnalyticsProvider.tsx");
const layoutSource = readSource("app/layout.tsx");
const productRuntime = productRuntimeSource();

// 1. Event allowlist
assert("1 events.ts exists", eventsSource.length > 0);
assert("1 exactly 11 approved events", CUSTOM_EVENT_NAMES.length === 11);
assert(
  "1 130D frozen event names preserved",
  FROZEN_130D_CUSTOM_EVENT_NAMES.every((name) => CUSTOM_EVENT_NAMES.includes(name)),
);
assert(
  "1 approved event names match spec",
  CUSTOM_EVENT_NAMES.join(",") ===
    [
      ...FROZEN_130D_CUSTOM_EVENT_NAMES,
      "subscription_complete",
      "monitor_create_start",
      "monitor_create_success",
      "monitor_create_error",
    ].join(","),
);
assert("1 no find_tool_open yet", !eventsSource.includes("find_tool_open"));
assert("1 no tool_view event", !CUSTOM_EVENT_NAMES.includes("tool_view" as never));

// 2. Parameter allowlists
assert("1 tool_process_start allowlist", EVENT_PARAMETER_ALLOWLIST.tool_process_start.includes("tool_slug"));
assert("1 find_tool_search uses query_length not query", EVENT_PARAMETER_ALLOWLIST.find_tool_search.includes("query_length"));
assert("1 forbidden parameter blocklist exists", FORBIDDEN_PARAMETER_NAMES.includes("filename"));

// 3. Runtime sanitization tests
const validStart = sanitizeCustomEvent("tool_process_start", {
  tool_slug: "merge-pdf",
  tool_category: "pdf",
  processing_type: "client",
  plan_gate: "free",
});
assert("2 valid tool_process_start accepted", validStart.ok === true);

const forbiddenFilename = sanitizeCustomEvent("tool_download", {
  tool_slug: "merge-pdf",
  tool_category: "pdf",
  output_count: 1,
  download_type: "single",
  filename: "secret.pdf",
} as never);
assert("2 forbidden filename rejected", forbiddenFilename.ok === false);

const unknownParam = sanitizeCustomEvent("checkout_start", {
  tier: "pro",
  billing_interval: "month",
  source_surface: "pricing",
  user_id: "abc",
} as never);
assert("2 unknown parameter rejected", unknownParam.ok === false);

const rawQuery = sanitizeCustomEvent("find_tool_search", {
  query_length: 5,
  result_count: 2,
  source_surface: "tool_finder",
  query: "merge",
} as never);
assert("2 raw query parameter rejected", rawQuery.ok === false);

const invalidEnum = sanitizeCustomEvent("tool_process_error", {
  tool_slug: "merge-pdf",
  tool_category: "pdf",
  processing_type: "client",
  error_code: "not_a_real_code",
} as unknown as ToolProcessErrorParams);
assert("2 invalid error_code rejected", invalidEnum.ok === false);

// 4. trackEvent foundation in ga4.ts
assert("3 trackEvent exported from ga4", ga4Source.includes("export function trackEvent"));
assert("3 trackEvent uses sanitizeCustomEvent", ga4Source.includes("sanitizeCustomEvent"));
assert("3 canSendCustomAnalyticsEvent helper exists", ga4Source.includes("canSendCustomAnalyticsEvent"));
assert("3 consent gate uses isAnalyticsConsentGranted", ga4Source.includes("isAnalyticsConsentGranted"));
assert("3 requires isGaReady", ga4Source.includes("isGaReady()"));
assert("3 requires isGaConfigured", ga4Source.includes("isGaConfigured()"));
assert("3 respects ga-disable", ga4Source.includes("isGaDisabledForMeasurement"));
assert("3 drops not queues", ga4Source.includes('"dropped"') && ga4Source.includes("never queues"));
assert("3 custom events use send_to only", ga4Source.includes("send_to: measurementId") && !ga4Source.match(/user_id|user_properties/));
assert("3 no event dedupe by tool_slug window", !ga4Source.includes("30") || !ga4Source.includes("dedupe") || ga4Source.includes("No operation-level dedupe"));
assert("3 page_view dedupe unchanged", ga4Source.includes("lastSentRouteKey"));
assert("3 send_page_view false preserved", ga4Source.includes("send_page_view: false"));

// 5. Product events route through ga4 (Step 2B+)
assert("4 no direct gtag event calls outside ga4 analytics layer", !productRuntime.includes('gtag("event"'));
assert(
  "4 product trackEvent imports ga4 when present",
  !productRuntime.includes("trackEvent(") || productRuntime.includes('@/lib/analytics/ga4'),
);

// 6. Frozen components
assert("5 GoogleAnalytics.tsx unchanged loader", googleAnalyticsSource.includes("getGtagJsUrl") && googleAnalyticsSource.includes('decision !== "accepted"'));
assert("5 AnalyticsProvider unchanged pageviews", analyticsProviderSource.includes("trackPageView") && !analyticsProviderSource.includes("trackEvent"));
assert("6 favicon metadata unchanged", layoutSource.includes('apple: "/icon.png"') && !layoutSource.includes('url: "/icon.png"'));

// 7. No second SDK / GTM / Ads
const analyticsRuntime = [eventsSource, ga4Source, readSource("lib/analytics/consent.ts")].join("\n");
assert("7 no GTM in analytics layer", !/googletagmanager\.com\/gtm\.js/i.test(analyticsRuntime));
assert("7 no @vercel/analytics", !readSource("package.json").includes("@vercel/analytics"));

// 8. Package script registered
assert("8 verify script registered", readSource("package.json").includes("verify:analytics-130d-step2a"));

console.log(`\n130D Step 2A verify: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
