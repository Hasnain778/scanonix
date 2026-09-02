/**
 * Phase 130D-2A — GA4 page_view query/hash privacy hardening.
 * Run: npx --yes tsx scripts/verify-analytics-130d-2a-page-view-privacy.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  sanitizeGaPageLocation,
  sanitizeGaPagePath,
} from "../lib/analytics/ga4";
import { EVENT_PARAMETER_ALLOWLIST, FORBIDDEN_PARAMETER_NAMES } from "../lib/analytics/events";

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

console.log("Phase 130D-2A — page_view privacy verification\n");

const ga4Source = readSource("lib/analytics/ga4.ts");
const providerSource = readSource("components/analytics/AnalyticsProvider.tsx");
const consentSource = readSource("lib/analytics/consent.ts");
const eventsSource = readSource("lib/analytics/events.ts");

// A–E: sanitizer behavior
assert(
  "A billing success path drops session_id",
  sanitizeGaPagePath("/billing/success?session_id=SECRET") === "/billing/success",
);
assert(
  "B compress-pdf drops utm + hash",
  sanitizeGaPagePath("/tools/compress-pdf?utm_source=test#result") ===
    "/tools/compress-pdf",
);
assert(
  "C absolute location drops token + hash",
  sanitizeGaPageLocation("https://www.scanonix.com/account?token=SECRET#x") ===
    "https://www.scanonix.com/account",
);
assert(
  "D sensitive values absent from path payload",
  !sanitizeGaPagePath("/billing/success?session_id=cs_secret&foo=bar").includes("session_id") &&
    !sanitizeGaPagePath("/billing/success?session_id=cs_secret&foo=bar").includes("cs_secret") &&
    !sanitizeGaPagePath("/billing/success?session_id=cs_secret&foo=bar").includes("foo"),
);
assert(
  "D sensitive values absent from location payload",
  !sanitizeGaPageLocation(
    "https://www.scanonix.com/billing/success?session_id=cs_secret",
  ).includes("session_id") &&
    !sanitizeGaPageLocation(
      "https://www.scanonix.com/billing/success?session_id=cs_secret",
    ).includes("cs_secret"),
);
assert(
  "E normal pathname unchanged",
  sanitizeGaPagePath("/tools/background-remover") === "/tools/background-remover" &&
    sanitizeGaPagePath("/account") === "/account" &&
    sanitizeGaPagePath("/billing/success") === "/billing/success",
);

assert(
  "A absolute URL path extraction",
  sanitizeGaPagePath(
    "https://www.scanonix.com/billing/success?session_id=cs_secret&foo=bar",
  ) === "/billing/success",
);

const built = {
  page_path: sanitizeGaPagePath("/billing/success?session_id=SECRET"),
  page_location: sanitizeGaPageLocation(
    "https://www.scanonix.com/billing/success?session_id=SECRET&foo=bar",
  ),
};
assert(
  "D buildPageView-shaped payload has no secrets",
  built.page_path === "/billing/success" &&
    built.page_location === "https://www.scanonix.com/billing/success" &&
    !JSON.stringify(built).includes("SECRET") &&
    !JSON.stringify(built).includes("session_id"),
);

// Source wiring
assert(
  "ga4 exports sanitizeGaPagePath",
  ga4Source.includes("export function sanitizeGaPagePath"),
);
assert(
  "ga4 exports sanitizeGaPageLocation",
  ga4Source.includes("export function sanitizeGaPageLocation"),
);
assert(
  "ga4 dispatch uses buildPageViewPayload / sanitizers",
  ga4Source.includes("buildPageViewPayload") &&
    ga4Source.includes("sanitizeGaPagePath") &&
    !ga4Source.includes("page_location: window.location.href"),
);
assert(
  "ga4 trackPageView dedupes sanitized pathname",
  ga4Source.includes("sanitizeGaPagePath(routeKey)") &&
    ga4Source.includes("lastSentRouteKey = sanitizedKey"),
);
assert("send_page_view false preserved", ga4Source.includes("send_page_view: false"));

assert(
  "AnalyticsProvider pathname-only (no searchParams route key)",
  providerSource.includes("usePathname") &&
    providerSource.includes("trackPageView(pathname)") &&
    !providerSource.includes("useSearchParams") &&
    !providerSource.includes("buildRouteKey"),
);

// F: custom event taxonomy unchanged
assert(
  "F tool_process_start allowlist unchanged",
  EVENT_PARAMETER_ALLOWLIST.tool_process_start.join(",") ===
    "tool_slug,tool_category,processing_type,plan_gate",
);
assert(
  "F forbidden list still blocks session_id",
  (FORBIDDEN_PARAMETER_NAMES as readonly string[]).includes("session_id"),
);
assert(
  "F events module still has subscription_complete",
  eventsSource.includes("subscription_complete"),
);

// G: consent gating unchanged
assert(
  "G consent storage key unchanged",
  consentSource.includes('CONSENT_STORAGE_KEY = "scanonix_consent_v1"'),
);
assert(
  "G trackEvent still requires isAnalyticsConsentGranted",
  ga4Source.includes("isAnalyticsConsentGranted()"),
);
assert(
  "G AnalyticsProvider still gates on accepted",
  providerSource.includes('decision !== "accepted"'),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
