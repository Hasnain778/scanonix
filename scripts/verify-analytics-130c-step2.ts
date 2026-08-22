/**
 * Phase 130C Step 2 — consent-gated GA4 base measurement verification.
 * Run: npm run verify:analytics-130c-step2
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PRIVACY_SECTIONS } from "../lib/legal/content";

const MEASUREMENT_ID_LITERAL = "G-FE2PVZ1QZZ";
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

console.log("Phase 130C Step 2 — GA4 base measurement verification\n");

// 1. Env-driven measurement ID
const envPublic = readSource("config/env.public.ts");
const envExample = readSource(".env.local.example");
assert("1 env.public exposes gaMeasurementId", envPublic.includes("gaMeasurementId"));
assert("1 getGaMeasurementId helper exists", envPublic.includes("getGaMeasurementId"));
assert("1 env template documents NEXT_PUBLIC_GA_MEASUREMENT_ID", envExample.includes("NEXT_PUBLIC_GA_MEASUREMENT_ID"));
assert("1 no hardcoded measurement ID in ga4.ts", !readSource("lib/analytics/ga4.ts").includes(MEASUREMENT_ID_LITERAL));

const ga4Source = readSource("lib/analytics/ga4.ts");
assert("1 ga4 module exists", ga4Source.length > 0);
assert("1 send_page_view false in config", ga4Source.includes("send_page_view: false"));
assert("1 allow_google_signals false", ga4Source.includes("allow_google_signals: false"));
assert("1 allow_ad_personalization_signals false", ga4Source.includes("allow_ad_personalization_signals: false"));
assert("1 ad_storage denied", ga4Source.includes('ad_storage: "denied"'));
assert("1 ga-disable helper exists", ga4Source.includes("ga-disable-"));
assert("1 clearGaCookies targets _ga", ga4Source.includes('name !== "_ga"') || ga4Source.includes('name === "_ga"'));
assert("1 manual page_view event", ga4Source.includes('"page_view"'));
assert("1 page_view includes page_location", ga4Source.includes("page_location"));
assert("1 queryable GA ready flag", ga4Source.includes("__scanonixGaRuntime"));
assert("1 isGaReady helper exists", ga4Source.includes("isGaReady"));
assert("1 subscribeToGaReady helper exists", ga4Source.includes("subscribeToGaReady"));
assert("1 config gated on script loaded", ga4Source.includes("scriptLoaded"));
assert("1 markGaReady gated on script loaded", ga4Source.includes("markGaReady") && ga4Source.includes("!rt.bootstrapComplete"));
assert("1 consent update after script load", ga4Source.includes('"consent", "update", CONSENT_GRANTED'));
assert("1 bootstrap before script load", ga4Source.includes("bootstrapGaBeforeScript"));
assert("1 bootstrap idempotent guard", ga4Source.includes("bootstrapComplete"));
assert("1 single config per measurement ID", ga4Source.includes("ensureMeasurementConfigured"));
assert("1 configuredMeasurementIds tracking", ga4Source.includes("configuredMeasurementIds"));
assert("1 config queued before gtag.js download", ga4Source.includes('gtag("config", measurementId') || ga4Source.includes("ensureMeasurementConfigured"));
assert("1 documented gtag.js id loader helper", ga4Source.includes("getGtagJsUrl") && ga4Source.includes("gtag/js?id="));
assert("1 enhanced measurement admin note", ga4Source.includes("browser history events"));
assert("1 gtag stub pushes arguments object", ga4Source.includes("dataLayer!.push(arguments)"));
assert("1 gtag stub does not push rest-args array", !ga4Source.includes("dataLayer?.push(args)"));
assert("1 page_view uses send_to", ga4Source.includes("send_to: measurementId"));
assert("1 sendPageView requires GA ready", ga4Source.includes("trackPageView") && ga4Source.includes("!isGaReady()"));
assert("1 canonical trackPageView sender", ga4Source.includes("export function trackPageView"));
assert("1 global route dedupe", ga4Source.includes("lastSentRouteKey"));
assert("1 resetPageViewDedupe on runtime reset", ga4Source.includes("resetPageViewDedupe()"));
assert("1 page_view dedupe debug", ga4Source.includes("reason=dedupe"));
assert("1 subscribeToGaReady no immediate microtask", !ga4Source.includes("queueMicrotask(callback)"));
assert("1 dataLayer forensics diagnostics", ga4Source.includes("debugLogDataLayer"));
assert("1 activation idempotent guard", ga4Source.includes("markGaActivationComplete"));
assert("1 config preserved on withdrawal reset", ga4Source.includes("config destinations preserved"));

// 2. Components
const googleAnalytics = readSource("components/analytics/GoogleAnalytics.tsx");
assert("2 GoogleAnalytics component exists", googleAnalytics.length > 0);
assert("2 script only when accepted", googleAnalytics.includes('decision !== "accepted"'));
assert("2 afterInteractive strategy", googleAnalytics.includes('strategy="afterInteractive"'));
assert("2 gtag/js uses env measurement id in URL", googleAnalytics.includes("getGtagJsUrl(measurementId)"));
assert("2 no hardcoded gtag js URL", !googleAnalytics.includes("gtag/js?id=G-"));
assert("2 no hardcoded ID in GoogleAnalytics", !googleAnalytics.includes(MEASUREMENT_ID_LITERAL));
assert("2 bootstrap script before gtag js", googleAnalytics.indexOf("scanonix-ga4-bootstrap") < googleAnalytics.indexOf('id="scanonix-ga4"'));
assert("2 config runs from script onLoad", googleAnalytics.includes("onLoad") && googleAnalytics.includes("markGaScriptLoaded"));
assert("2 bootstrap wired before external script", googleAnalytics.includes("onReady={bootstrapGaBeforeScript}"));
assert("2 markGaReady after script activation", googleAnalytics.includes("refreshGrantedAnalytics") && googleAnalytics.includes("markGaReady"));
assert("2 global activation guard", googleAnalytics.includes("markGaActivationComplete"));
assert("2 no duplicate bootstrap in useEffect", !googleAnalytics.includes("initGaBootstrap"));

const analyticsProvider = readSource("components/analytics/AnalyticsProvider.tsx");
assert("2 AnalyticsProvider exists", analyticsProvider.includes("usePathname"));
assert("2 AnalyticsProvider uses useSearchParams", analyticsProvider.includes("useSearchParams"));
assert("2 dedupe last sent path", !analyticsProvider.includes("lastSentPath"));
assert("2 canonical trackPageView sender", analyticsProvider.includes("trackPageView"));
assert("2 mutually exclusive ready dispatch", analyticsProvider.includes("if (isGaReady())") && analyticsProvider.includes("return subscribeToGaReady"));
assert("2 checks isGaReady on mount", analyticsProvider.includes("isGaReady"));
assert("2 subscribeToGaReady for late listeners", analyticsProvider.includes("subscribeToGaReady"));

const consentRoot = readSource("components/analytics/ConsentRoot.tsx");
assert("2 ConsentRoot mounts GoogleAnalytics", consentRoot.includes("GoogleAnalytics"));
assert("2 ConsentRoot mounts AnalyticsProvider", consentRoot.includes("AnalyticsProvider"));

// 3. Consent integration
const consentSource = readSource("lib/analytics/consent.ts");
assert("3 consent key preserved", consentSource.includes("scanonix_consent_v1"));
assert("3 reject disables analytics tracking", consentSource.includes("disableAnalyticsTracking"));
assert("3 reject clears GA cookies", consentSource.includes("clearGaCookies"));
assert("3 accept enables analytics tracking", consentSource.includes("enableAnalyticsTracking"));

// 4. No GTM / ads / custom events
const runtimeDirs = ["app", "components", "lib"].map((dir) => join(root, dir));
const runtimeCombined = runtimeDirs
  .flatMap((dir) => walkRuntimeSources(dir))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

assert("4 no GTM container in runtime", !/googletagmanager\.com\/gtm\.js/i.test(runtimeCombined));
const productRuntimeCombined = runtimeDirs
  .flatMap((dir) => walkRuntimeSources(dir))
  .filter((path) => !path.includes(`${join(root, "lib", "analytics")}`))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
assert(
  "4 product trackEvent routed via ga4 when present",
  !productRuntimeCombined.includes("trackEvent(") ||
    productRuntimeCombined.includes('@/lib/analytics/ga4'),
);
assert("4 no legacy tool_view funnel event", !productRuntimeCombined.includes("tool_view"));
assert("4 custom event schema in analytics layer", existsSync(join(root, "lib", "analytics", "events.ts")));
assert("4 trackEvent foundation in ga4", readSource("lib/analytics/ga4.ts").includes("export function trackEvent"));

// 5. Privacy + 130B preserved
const analyticsSection = PRIVACY_SECTIONS.find((section) => section.id === "analytics");
const analyticsText = analyticsSection?.paragraphs.join(" ") ?? "";
assert("5 Step 1 privacy GA4 disclosure preserved", /Google Analytics 4/i.test(analyticsText));
assert("5 consent-based disclosure preserved", /consent-based/i.test(analyticsText));

const providersSource = readSource("app/providers.tsx");
assert("5 ConsentRoot still in providers", providersSource.includes("ConsentRoot"));
assert("5 layout metadata untouched", !readSource("app/layout.tsx").includes("googletagmanager"));

// 6. GSC + SEO untouched
assert("6 GSC auth preserved", existsSync(join(root, "lib/seo/local/auth.ts")));
assert("6 tool-seo preserved", readSource("constants/tool-seo.ts").length > 10_000);

assert("7 verify script registered", readSource("package.json").includes("verify:analytics-130c-step2"));

console.log(`\n130C Step 2 verify: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
