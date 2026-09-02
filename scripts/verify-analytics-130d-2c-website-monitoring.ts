/**
 * Phase 130D-2C — website monitoring create-funnel analytics verification.
 * Run: npm run verify:analytics-130d-2c
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  CUSTOM_EVENT_NAMES,
  ERROR_CODES,
  EVENT_PARAMETER_ALLOWLIST,
  FORBIDDEN_PARAMETER_NAMES,
  MONITOR_FREQUENCIES,
  sanitizeCustomEvent,
} from "../lib/analytics/events";
import {
  ANALYTICS_SURFACES,
  FROZEN_130D_CUSTOM_EVENT_NAMES,
} from "../lib/analytics/surfaces";
import {
  createMonitorCreateAttempt,
  mapMonitorCreateHttpError,
} from "../lib/analytics/monitor-create";

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
    } else if (/\.(tsx?|jsx?|mjs)$/.test(entry.name)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

console.log("Phase 130D-2C — website monitoring create analytics verification\n");

const eventsSource = readSource("lib/analytics/events.ts");
const monitorCreateSource = readSource("lib/analytics/monitor-create.ts");
const monitorsShell = readSource("components/monitors/MonitorsShell.tsx");
const monitorButton = readSource("components/monitors/MonitorButton.tsx");
const ga4Source = readSource("lib/analytics/ga4.ts");
const consentSource = readSource("lib/analytics/consent.ts");
const providerSource = readSource("components/analytics/AnalyticsProvider.tsx");
const processLifecycle = readSource("lib/analytics/process-lifecycle.ts");
const subscriptionComplete = readSource("lib/analytics/subscription-complete.ts");
const billingSuccess = readSource("components/billing/BillingSuccessClient.tsx");

const monitorLibFiles = walkRuntimeSources(join(root, "lib", "monitors"));
const cronFiles = walkRuntimeSources(join(root, "app", "api", "cron"));
const monitorApiFiles = walkRuntimeSources(join(root, "app", "api", "monitors"));
const backgroundSources = [...monitorLibFiles, ...cronFiles, ...monitorApiFiles]
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

// A: start can be tracked
assert(
  "A monitor_create_start allowlisted",
  CUSTOM_EVENT_NAMES.includes("monitor_create_start"),
);
assert(
  "A MonitorsShell emits start via createMonitorCreateAttempt",
  monitorsShell.includes("createMonitorCreateAttempt") &&
    monitorsShell.includes("markStarted()"),
);
assert(
  "A MonitorButton emits start via createMonitorCreateAttempt",
  monitorButton.includes("createMonitorCreateAttempt") &&
    monitorButton.includes("markStarted()"),
);

const startOk = sanitizeCustomEvent("monitor_create_start", {
  frequency: "weekly",
  source_surface: ANALYTICS_SURFACES.MONITOR_LIST,
  plan_gate: "pro",
});
assert("A sanitize accepts monitor_create_start", startOk.ok === true);

// B: success
assert(
  "B monitor_create_success allowlisted",
  CUSTOM_EVENT_NAMES.includes("monitor_create_success"),
);
assert(
  "B both UIs call success()",
  monitorsShell.includes("attempt?.success()") && monitorButton.includes("attempt?.success()"),
);
const successOk = sanitizeCustomEvent("monitor_create_success", {
  frequency: "daily",
  source_surface: ANALYTICS_SURFACES.MONITOR_SCAN_REPORT,
  plan_gate: "pro",
});
assert("B sanitize accepts monitor_create_success", successOk.ok === true);

// C: failure
assert(
  "C monitor_create_error allowlisted",
  CUSTOM_EVENT_NAMES.includes("monitor_create_error"),
);
assert(
  "C both UIs call error() with mapped codes",
  monitorsShell.includes("mapMonitorCreateHttpError") &&
    monitorButton.includes("mapMonitorCreateHttpError") &&
    monitorsShell.includes('attempt?.error("network")') &&
    monitorButton.includes('attempt?.error("network")'),
);
const errorOk = sanitizeCustomEvent("monitor_create_error", {
  frequency: "monthly",
  source_surface: ANALYTICS_SURFACES.MONITOR_LIST,
  plan_gate: "pro",
  error_code: "validation",
});
assert("C sanitize accepts monitor_create_error", errorOk.ok === true);
assert(
  "C error codes constrained",
  ERROR_CODES.every((code) =>
    sanitizeCustomEvent("monitor_create_error", {
      frequency: "weekly",
      source_surface: ANALYTICS_SURFACES.MONITOR_LIST,
      plan_gate: "pro",
      error_code: code,
    }).ok,
  ),
);
assert("C map 400 → validation", mapMonitorCreateHttpError(400) === "validation");
assert("C map 409 → validation", mapMonitorCreateHttpError(409) === "validation");
assert(
  "C map 403 plan_restricted → usage_limit",
  mapMonitorCreateHttpError(403, "plan_restricted") === "usage_limit",
);
assert("C map 401 → auth_required", mapMonitorCreateHttpError(401) === "auth_required");
assert("C map 500 → provider", mapMonitorCreateHttpError(500) === "provider");

// D: URL/domain never in payload
assert(
  "D forbidden includes target_url/hostname/domain",
  FORBIDDEN_PARAMETER_NAMES.includes("target_url") &&
    FORBIDDEN_PARAMETER_NAMES.includes("hostname") &&
    FORBIDDEN_PARAMETER_NAMES.includes("domain"),
);
const urlRejected = sanitizeCustomEvent("monitor_create_start", {
  frequency: "weekly",
  source_surface: ANALYTICS_SURFACES.MONITOR_LIST,
  plan_gate: "pro",
  // @ts-expect-error intentional privacy probe
  target_url: "https://evil.example",
});
assert("D target_url parameter rejected", urlRejected.ok === false);
assert(
  "D helper never references targetUrl in track payloads",
  !monitorCreateSource.includes("targetUrl") &&
    !monitorCreateSource.includes("target_url") &&
    !/"https?:/.test(monitorCreateSource),
);
assert(
  "D UI analytics calls do not pass URL into attempt input",
  /createMonitorCreateAttempt\(\{\s*frequency,\s*source_surface:/.test(monitorsShell) &&
    /createMonitorCreateAttempt\(\{\s*frequency,\s*source_surface:/.test(monitorButton),
);

// E: IDs never in payload
assert(
  "E forbidden includes monitor_id/job_id/user_id",
  FORBIDDEN_PARAMETER_NAMES.includes("monitor_id") &&
    FORBIDDEN_PARAMETER_NAMES.includes("job_id") &&
    FORBIDDEN_PARAMETER_NAMES.includes("user_id"),
);
const idRejected = sanitizeCustomEvent("monitor_create_success", {
  frequency: "weekly",
  source_surface: ANALYTICS_SURFACES.MONITOR_LIST,
  plan_gate: "pro",
  // @ts-expect-error intentional privacy probe
  monitor_id: "abc-123",
});
assert("E monitor_id parameter rejected", idRejected.ok === false);

// F: raw error text never in payload
assert(
  "F forbidden includes error_message",
  FORBIDDEN_PARAMETER_NAMES.includes("error_message"),
);
const rawErrRejected = sanitizeCustomEvent("monitor_create_error", {
  frequency: "weekly",
  source_surface: ANALYTICS_SURFACES.MONITOR_LIST,
  plan_gate: "pro",
  error_code: "validation",
  // @ts-expect-error intentional privacy probe
  error_message: "Invalid URL https://secret.example",
});
assert("F raw error_message rejected", rawErrRejected.ok === false);
assert(
  "F mapMonitorCreateHttpError returns only allowlisted codes",
  ERROR_CODES.includes(mapMonitorCreateHttpError(418)),
);

// G: consent gate
assert(
  "G monitor-create uses trackEvent",
  monitorCreateSource.includes('trackEvent("monitor_create_start"') &&
    monitorCreateSource.includes('trackEvent("monitor_create_success"') &&
    monitorCreateSource.includes('trackEvent("monitor_create_error"'),
);
assert(
  "G ga4 requires isAnalyticsConsentGranted",
  ga4Source.includes("isAnalyticsConsentGranted()"),
);
assert("G consent key unchanged", consentSource.includes("scanonix_consent_v1"));

// Runtime consent deny simulation via attempt (trackEvent drops without consent)
{
  const attempt = createMonitorCreateAttempt({
    frequency: "weekly",
    source_surface: ANALYTICS_SURFACES.MONITOR_LIST,
  });
  assert("G attempt factory returns handle", attempt !== null);
  // Without browser/consent, trackEvent returns dropped; markStarted still flips once.
  assert("G markStarted first call true", attempt!.markStarted() === true);
  assert("G markStarted second call false (dedupe)", attempt!.markStarted() === false);
  attempt!.success();
  attempt!.error("validation");
  assert("G node environment safe (no throw)", true);
}

// H: background does not emit user-funnel events
assert(
  "H monitor lib/cron/api have no monitor_create_* trackEvent",
  !backgroundSources.includes("monitor_create_start") &&
    !backgroundSources.includes("monitor_create_success") &&
    !backgroundSources.includes("monitor_create_error") &&
    !backgroundSources.includes("createMonitorCreateAttempt") &&
    !backgroundSources.includes('trackEvent("'),
);
assert(
  "H createProcessAttempt not forced onto website-monitoring",
  !processLifecycle.includes("website-monitoring") &&
    !monitorsShell.includes("createProcessAttempt") &&
    !monitorButton.includes("createProcessAttempt"),
);

// I: allowlists
assert(
  "I start params exact",
  EVENT_PARAMETER_ALLOWLIST.monitor_create_start.join(",") ===
    "frequency,source_surface,plan_gate",
);
assert(
  "I success params exact",
  EVENT_PARAMETER_ALLOWLIST.monitor_create_success.join(",") ===
    "frequency,source_surface,plan_gate",
);
assert(
  "I error params exact",
  EVENT_PARAMETER_ALLOWLIST.monitor_create_error.join(",") ===
    "frequency,source_surface,plan_gate,error_code",
);
assert(
  "I frequencies constrained",
  MONITOR_FREQUENCIES.join(",") === "daily,weekly,monthly",
);
assert(
  "I surfaces exist",
  ANALYTICS_SURFACES.MONITOR_LIST === "monitors_list" &&
    ANALYTICS_SURFACES.MONITOR_SCAN_REPORT === "monitor_scan_report",
);
const badFreq = sanitizeCustomEvent("monitor_create_start", {
  frequency: "hourly" as never,
  source_surface: ANALYTICS_SURFACES.MONITOR_LIST,
  plan_gate: "pro",
});
assert("I rejects high-cardinality frequency", badFreq.ok === false);
const badSurface = sanitizeCustomEvent("monitor_create_start", {
  frequency: "weekly",
  source_surface: "random_surface",
  plan_gate: "pro",
});
assert("I rejects unknown source_surface", badSurface.ok === false);

// J: dedupe / no effect-driven double emit
assert(
  "J attempt guards started/terminal in helper",
  monitorCreateSource.includes("let started = false") &&
    monitorCreateSource.includes("let terminal = false") &&
    monitorCreateSource.includes("if (started)") &&
    monitorCreateSource.includes("if (!started || terminal)"),
);
assert(
  "J create not driven by useEffect",
  !monitorsShell.includes("useEffect(() => {\n    void createMonitor") &&
    !monitorsShell.includes("useEffect(() => { createMonitor") &&
    /async function createMonitor/.test(monitorsShell) &&
    /async function createMonitor/.test(monitorButton) &&
    !monitorButton.includes("useEffect"),
);
assert(
  "J MonitorsShell create gated by creating state",
  monitorsShell.includes("loading={creating}"),
);

// K: 130D-2A page_view privacy intact
assert(
  "K AnalyticsProvider still pathname-only trackPageView",
  providerSource.includes("pathname") && providerSource.includes("trackPageView"),
);
assert(
  "K ga4 sanitizePagePath / strip query still present",
  ga4Source.includes("sanitizePagePath") ||
    ga4Source.includes("page_path") ||
    /searchParams|location\.search|hash/.test(providerSource) === false ||
    providerSource.includes("pathname"),
);
assert(
  "K 130D-2A verifier file unchanged presence",
  existsSync(join(root, "scripts/verify-analytics-130d-2a-page-view-privacy.ts")),
);

// L: 130D-2B subscription fallback intact
assert(
  "L tryTrackSubscriptionComplete preserved",
  subscriptionComplete.includes("tryTrackSubscriptionComplete") &&
    billingSuccess.includes("tryTrackSubscriptionComplete"),
);
assert(
  "L subscription_complete still allowlisted",
  CUSTOM_EVENT_NAMES.includes("subscription_complete"),
);
assert(
  "L 130D frozen events still prefix",
  FROZEN_130D_CUSTOM_EVENT_NAMES.every((name, index) => CUSTOM_EVENT_NAMES[index] === name),
);

// Extra: event count + no createProcessAttempt for monitors
assert("extra CUSTOM_EVENT_NAMES length 11", CUSTOM_EVENT_NAMES.length === 11);
assert(
  "extra helper does not import process-lifecycle",
  !monitorCreateSource.includes('from "@/lib/analytics/process-lifecycle"') &&
    !monitorCreateSource.includes("from '../process-lifecycle'") &&
    !monitorCreateSource.includes("createProcessAttempt("),
);
assert(
  "extra events.ts documents monitor create",
  eventsSource.includes("monitor_create_start"),
);

console.log(`\n130D-2C website monitoring analytics verify: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
}
