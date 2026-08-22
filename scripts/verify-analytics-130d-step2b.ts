/**
 * Phase 130D Step 2B — central event instrumentation verification.
 * Run: npm run verify:analytics-130d-step2b
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ANALYTICS_SURFACES, FROZEN_130D_CUSTOM_EVENT_NAMES } from "../lib/analytics/surfaces";
import {
  CUSTOM_EVENT_NAMES,
  FORBIDDEN_PARAMETER_NAMES,
  sanitizeCustomEvent,
} from "../lib/analytics/events";

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

function productRuntimeFiles(): string[] {
  return ["app", "components", "lib"]
    .map((dir) => join(root, dir))
    .flatMap((dir) => walkRuntimeSources(dir))
    .filter((path) => !path.includes(`${join("lib", "analytics")}`));
}

function productRuntimeSource(): string {
  return productRuntimeFiles()
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

function countMatches(source: string, pattern: RegExp): number {
  return (source.match(pattern) ?? []).length;
}

function relativeFromRoot(fullPath: string): string {
  return fullPath.slice(root.length + 1).replace(/\\/g, "/");
}

console.log("Phase 130D Step 2B — central event instrumentation verification\n");

const downloadSource = readSource("lib/utils/download.ts");
const checkoutSource = readSource("components/billing/CheckoutButton.tsx");
const toolFinderSource = readSource("components/tool-finder/ToolFinderRoot.tsx");
const ga4Source = readSource("lib/analytics/ga4.ts");
const googleAnalyticsSource = readSource("components/analytics/GoogleAnalytics.tsx");
const analyticsProviderSource = readSource("components/analytics/AnalyticsProvider.tsx");
const consentSource = readSource("lib/analytics/consent.ts");
const layoutSource = readSource("app/layout.tsx");
const productRuntime = productRuntimeSource();
const productFiles = productRuntimeFiles();

// 1. Central download instrumentation
assert("1 download.ts imports trackEvent from ga4", downloadSource.includes('from "@/lib/analytics/ga4"'));
assert("1 downloadBlob accepts analyticsMeta", downloadSource.includes("analyticsMeta?: DownloadAnalyticsMeta"));
assert("1 downloadOutputs accepts analyticsMeta", downloadSource.includes("analyticsMeta?: DownloadOutputsAnalyticsMeta"));
assert("1 tool_download emitted via trackEvent", downloadSource.includes('trackEvent("tool_download"'));
assert("1 buildToolDownloadMeta helper exists", existsSync(join(root, "lib/analytics/download-meta.ts")));
assert(
  "1 buildToolDownloadMeta resolves slug via category matrix",
  readSource("lib/analytics/download-meta.ts").includes("getPrimaryCategory"),
);

// 2. checkout_start
assert("2 CheckoutButton fires checkout_start on click path", checkoutSource.includes('trackEvent("checkout_start"'));
assert("2 checkout_start not in render/useEffect", !checkoutSource.match(/useEffect[\s\S]*checkout_start/));
assert(
  "2 checkout params are tier billing_interval source_surface",
  checkoutSource.includes("billing_interval") && checkoutSource.includes("source_surface"),
);
assert(
  "2 no stripe or PII keys in checkout_start payload",
  !checkoutSource.match(/trackEvent\("checkout_start"[\s\S]*?(stripe_|customer_id|email|price_id|user_id)/),
);
assert("2 checkout timing documented", checkoutSource.includes("session creation fails") || checkoutSource.includes("Stripe session"));

// 3. upgrade_click surfaces
const upgradeFiles = [
  "components/plan/ProPremiumGate.tsx",
  "components/tools/security/ProSecurityGate.tsx",
  "components/home/ScanonixProPromo.tsx",
  "components/plan/UsageBanner.tsx",
  "components/common/FeatureLock.tsx",
];
for (const file of upgradeFiles) {
  assert(`3 upgrade_click in ${file}`, readSource(file).includes('trackEvent("upgrade_click"'));
}
assert(
  "3 pricing checkout uses pricing surface",
  readSource("components/pricing/PricingPagePlans.tsx").includes("ANALYTICS_SURFACES.PRICING"),
);

// 4. find_tool_search
assert("4 ToolFinderRoot fires find_tool_search", toolFinderSource.includes('trackEvent("find_tool_search"'));
assert(
  "4 find_tool_search uses query_length not raw query",
  toolFinderSource.includes("query_length:") && !toolFinderSource.match(/query:\s*trimmed|search_query|raw_query/),
);
assert(
  "4 find_tool_search on submit not keystroke",
  !toolFinderSource.match(/onChange[\s\S]*find_tool_search/) && toolFinderSource.includes("submitSearch"),
);
assert("4 duplicate submit guard", toolFinderSource.includes("searchSubmitGuardRef"));

// 5. Process events routed via process-lifecycle (Step 2C)
assert(
  "5 process-lifecycle module exists",
  existsSync(join(root, "lib/analytics/process-lifecycle.ts")),
);
const lifecycleSource = readSource("lib/analytics/process-lifecycle.ts");
assert("5 createProcessAttempt exported", lifecycleSource.includes("export function createProcessAttempt"));
assert(
  "5 process events in lifecycle module",
  lifecycleSource.includes('trackEvent("tool_process_start"') &&
    lifecycleSource.includes('trackEvent("tool_process_success"') &&
    lifecycleSource.includes('trackEvent("tool_process_error"'),
);
assert("5 find_tool_open not implemented", !productRuntime.includes('trackEvent("find_tool_open"'));

// 6. All product events via trackEvent / ga4
const trackEventFiles = productFiles.filter((file) => readFileSync(file, "utf8").includes("trackEvent("));
assert("6 product trackEvent call sites present", trackEventFiles.length >= 4);
for (const file of trackEventFiles) {
  const src = readFileSync(file, "utf8");
  const rel = relativeFromRoot(file);
  assert(`6 ${rel} imports trackEvent from ga4`, src.includes('@/lib/analytics/ga4'));
}

// 7. No direct gtag outside core
assert("7 no gtag event calls outside lib/analytics", !productRuntime.includes('gtag("event"'));

function trackEventPayloadSource(source: string): string {
  return (source.match(/trackEvent\([\s\S]*?\);/g) ?? []).join("\n");
}

const trackEventPayloads = productFiles
  .map((file) => trackEventPayloadSource(readFileSync(file, "utf8")))
  .join("\n");

// 8. Forbidden params never passed as trackEvent keys
const forbiddenInTrackEvents = FORBIDDEN_PARAMETER_NAMES.filter((key) =>
  new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`).test(trackEventPayloads),
);
assert(
  "8 no forbidden parameter keys in trackEvent payloads",
  forbiddenInTrackEvents.length === 0,
  forbiddenInTrackEvents.join(", "),
);

// 9. source_surface constrained
const surfacesSource = readSource("lib/analytics/surfaces.ts");
assert("9 ANALYTICS_SURFACES constants file", surfacesSource.includes("export const ANALYTICS_SURFACES"));
const surfaceValues = Object.values(ANALYTICS_SURFACES);
assert("9 surfaces are snake_case low cardinality", surfaceValues.every((v) => /^[a-z0-9_]+$/.test(v)));

// 10. Consent / page_view / favicon preserved
assert("10 send_page_view false preserved", ga4Source.includes("send_page_view: false"));
assert(
  "10 trackPageView unchanged in AnalyticsProvider",
  analyticsProviderSource.includes("trackPageView") && !analyticsProviderSource.includes("trackEvent"),
);
assert("10 GoogleAnalytics consent gate preserved", googleAnalyticsSource.includes('decision !== "accepted"'));
assert("10 consent key preserved", consentSource.includes("scanonix_consent_v1"));
assert("10 reject disables analytics", consentSource.includes("disableAnalyticsTracking"));
assert("10 favicon metadata preserved", layoutSource.includes('apple: "/icon.png"'));

// 11. Download coverage audit
const downloadCallPattern = /downloadBlob\s*\(/g;
const downloadOutputsPattern = /downloadOutputs\s*\(/g;
let totalDownloadCalls = 0;
let instrumentedFiles = 0;
let uninstrumentedFiles = 0;

for (const file of productFiles) {
  const rel = relativeFromRoot(file);
  if (rel === "lib/utils/download.ts" || rel === "lib/tools/download.ts") continue;

  const src = readFileSync(file, "utf8");
  const blobCalls = countMatches(src, downloadCallPattern);
  const outputCalls = countMatches(src, downloadOutputsPattern);
  if (blobCalls + outputCalls === 0) continue;

  totalDownloadCalls += blobCalls + outputCalls;
  const hasMeta =
    src.includes("buildToolDownloadMeta") ||
    (src.includes("downloadOutputs") && src.includes("tool_slug:"));
  if (hasMeta) {
    instrumentedFiles += 1;
  } else {
    uninstrumentedFiles += 1;
  }
}

assert("11 download coverage total call sites > 0", totalDownloadCalls > 0, `count=${totalDownloadCalls}`);
assert("11 all download caller files instrumented", uninstrumentedFiles === 0, `${uninstrumentedFiles} uninstrumented files`);
console.log(
  `  download coverage: total call sites=${totalDownloadCalls} instrumented files=${instrumentedFiles} uninstrumented files=${uninstrumentedFiles}`,
);

// 12. Package script
assert("12 verify script registered", readSource("package.json").includes("verify:analytics-130d-step2b"));

// 13. Sanitizer still rejects bad payloads
assert(
  "13 filename still forbidden",
  sanitizeCustomEvent("tool_download", {
    tool_slug: "merge-pdf",
    tool_category: "pdf",
    output_count: 1,
    download_type: "single",
    filename: "x.pdf",
  } as never).ok === false,
);

assert(
  "13 raw query still forbidden",
  sanitizeCustomEvent("find_tool_search", {
    query_length: 3,
    result_count: 1,
    source_surface: "tool_finder",
    query: "pdf",
  } as never).ok === false,
);

const implemented130dInProduct = FROZEN_130D_CUSTOM_EVENT_NAMES.filter((name) => {
  if (name.startsWith("tool_process_")) {
    return lifecycleSource.includes(`trackEvent("${name}"`);
  }
  return productRuntime.includes(`trackEvent("${name}"`);
});
assert(
  "13 all 130D custom events implemented",
  implemented130dInProduct.sort().join(",") === FROZEN_130D_CUSTOM_EVENT_NAMES.slice().sort().join(","),
);

console.log(`\n130D Step 2B verify: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
