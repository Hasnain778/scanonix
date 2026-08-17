/**
 * Phase 130C Step 1 — GA4 privacy/legal preparation verification.
 * Run: npm run verify:analytics-130c-step1
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PRIVACY_SECTIONS } from "../lib/legal/content";

const MEASUREMENT_ID = "G-FE2PVZ1QZZ";
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

console.log("Phase 130C Step 1 — GA4 privacy/legal preparation\n");

const privacySource = readSource("lib/legal/content.ts");
const analyticsSection = PRIVACY_SECTIONS.find((section) => section.id === "analytics");
const cookiesSection = PRIVACY_SECTIONS.find((section) => section.id === "cookies");
const analyticsText = analyticsSection?.paragraphs.join(" ") ?? "";
const cookiesText = cookiesSection?.paragraphs.join(" ") ?? "";

assert("1 privacy policy source is lib/legal/content.ts", privacySource.includes("PRIVACY_SECTIONS"));
assert("1 analytics section exists", Boolean(analyticsSection));
assert("1 cookies section exists", Boolean(cookiesSection));
assert("1 Google Analytics 4 identified", /Google Analytics 4/i.test(analyticsText));
assert("1 analytics described as consent-based", /consent-based|only after you accept analytics/i.test(analyticsText));
assert("1 reject analytics prevents GA load", /reject analytics|does not load Google Analytics/i.test(analyticsText));
assert("1 Cookie preferences withdrawal disclosed", /Cookie preferences/i.test(analyticsText));
assert("1 withdraw consent disclosed", /withdraw/i.test(analyticsText));
assert(
  "1 no document content sent to GA claimed appropriately",
  /does not send names|document contents|tool-file data/i.test(analyticsText),
);
assert("1 Google service provider/processor mentioned", /service provider|data processor/i.test(analyticsText));
assert("1 Google privacy/terms referenced", /Google.*privacy policy|data processing terms/i.test(analyticsText));
assert("1 cookies section mentions consent-gated analytics", /only after you accept analytics/i.test(cookiesText));
assert("1 local consent preference storage disclosed", /local storage|locally in your browser/i.test(cookiesText));
assert("1 privacy last updated bumped", privacySource.includes('PRIVACY_LAST_UPDATED = "17 August 2026"'));

const runtimeDirs = ["app", "components", "lib"].map((dir) => join(root, dir));
const runtimeSources = runtimeDirs.flatMap((dir) => walkRuntimeSources(dir)).map((path) => readFileSync(path, "utf8"));
const runtimeCombined = runtimeSources.join("\n");

const analyticsRuntimePatterns = [
  /google-analytics\.com/,
  /@vercel\/analytics/,
];

for (const pattern of analyticsRuntimePatterns) {
  assert(`2 no runtime analytics pattern ${pattern}`, !pattern.test(runtimeCombined));
}

const ga4Source = readSource("lib/analytics/ga4.ts");
const googleAnalyticsSource = readSource("components/analytics/GoogleAnalytics.tsx");
assert("2 ga4 helper module exists", ga4Source.includes("send_page_view: false"));
assert("2 GoogleAnalytics consent-gates script load", googleAnalyticsSource.includes('decision !== "accepted"'));
assert("2 GoogleAnalytics uses env measurement ID", googleAnalyticsSource.includes("getMeasurementId()"));
assert("2 no hardcoded measurement ID in GoogleAnalytics", !googleAnalyticsSource.includes(MEASUREMENT_ID));

assert(`2 measurement ID absent from runtime code`, !runtimeCombined.includes(MEASUREMENT_ID));
assert("2 measurement ID absent from app/layout.tsx", !readSource("app/layout.tsx").includes(MEASUREMENT_ID));
assert("2 measurement ID absent from providers.tsx", !readSource("app/providers.tsx").includes(MEASUREMENT_ID));
assert("2 measurement ID absent from consent module", !readSource("lib/analytics/consent.ts").includes(MEASUREMENT_ID));

const envExample = readSource(".env.local.example");
assert("2 GA env documented in template", envExample.includes("NEXT_PUBLIC_GA_MEASUREMENT_ID"));

const consentSource = readSource("lib/analytics/consent.ts");
assert("3 130B consent key preserved", consentSource.includes("scanonix_consent_v1"));
assert("3 130B accept helper preserved", consentSource.includes("acceptAnalyticsConsent"));
assert("3 130B reject helper preserved", consentSource.includes("rejectAnalyticsConsent"));
assert("3 ConsentRoot still mounted", readSource("app/providers.tsx").includes("ConsentRoot"));
assert("3 footer Cookie preferences preserved", readSource("components/layout/Footer.tsx").includes("ConsentPreferencesLink"));

const packageJson = readSource("package.json");
assert("4 verify script registered", packageJson.includes("verify:analytics-130c-step1"));

console.log(`\n130C Step 1 verify: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
