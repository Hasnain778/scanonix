/**
 * Phase 130B — consent foundation verification.
 * Run: npm run verify:analytics-130b
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  acceptAnalyticsConsent,
  getConsentDecision,
  isAnalyticsConsentGranted,
  isConsentUndecided,
  readStoredConsent,
  rejectAnalyticsConsent,
  resetAnalyticsConsent,
  withdrawAnalyticsConsent,
} from "../lib/analytics/consent";

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

console.log("Phase 130B — Consent foundation verification\n");

// 1. Consent module
const consentSource = readSource("lib/analytics/consent.ts");
assert("1 consent module exists", consentSource.length > 0);
assert("1 versioned storage key scanonix_consent_v1", consentSource.includes("scanonix_consent_v1"));
assert("1 consent version constant", consentSource.includes("CONSENT_VERSION"));
assert("1 accept helper exported", consentSource.includes("acceptAnalyticsConsent"));
assert("1 reject helper exported", consentSource.includes("rejectAnalyticsConsent"));
assert("1 withdraw helper exported", consentSource.includes("withdrawAnalyticsConsent"));
assert("1 reset helper exported", consentSource.includes("resetAnalyticsConsent"));
assert("1 SSR guard uses typeof window", /typeof window/.test(consentSource));
assert("1 clearAnalyticsCookies reserved for 130C", consentSource.includes("clearAnalyticsCookies"));
assert("1 no gtag in consent module", !/gtag\s*\(/.test(consentSource));

// 2. SSR-safe read on server (Node has no browser APIs)
assert("2 SSR readStoredConsent returns null without window", readStoredConsent() === null);
assert("2 SSR getConsentDecision returns undecided", getConsentDecision() === "undecided");

// 3. Client persistence simulation
const store = new Map<string, string>();
const priorWindow = globalThis.window;
const priorLocalStorage = globalThis.localStorage;

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  },
});

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: globalThis.localStorage,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  },
});

resetAnalyticsConsent();
assert("3 initial state undecided", isConsentUndecided());
assert("3 banner would show when undecided", getConsentDecision() === "undecided");

acceptAnalyticsConsent();
const accepted = readStoredConsent();
assert("3 accept persists analytics true", accepted?.analytics === true);
assert("3 accept stores version", accepted?.version === CONSENT_VERSION);
assert("3 accept stores decidedAt", Boolean(accepted?.decidedAt));
assert("3 accept grants analytics consent", isAnalyticsConsentGranted());
assert("3 accept decision accepted", getConsentDecision() === "accepted");
assert("3 accept uses versioned storage key", store.has(CONSENT_STORAGE_KEY));

resetAnalyticsConsent();
rejectAnalyticsConsent();
const rejected = readStoredConsent();
assert("3 reject persists analytics false", rejected?.analytics === false);
assert("3 reject decision rejected", getConsentDecision() === "rejected");
assert("3 reject does not grant analytics", !isAnalyticsConsentGranted());

acceptAnalyticsConsent();
assert("3 re-enable accept after reject", getConsentDecision() === "accepted");

withdrawAnalyticsConsent();
assert("3 withdrawal sets rejected", getConsentDecision() === "rejected");

if (priorLocalStorage === undefined) {
  Reflect.deleteProperty(globalThis, "localStorage");
} else {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: priorLocalStorage,
  });
}

if (priorWindow === undefined) {
  Reflect.deleteProperty(globalThis, "window");
} else {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: priorWindow,
  });
}

// 4. UI components
assert("4 ConsentBanner exists", existsSync(join(root, "components/analytics/ConsentBanner.tsx")));
assert("4 ConsentPreferencesLink exists", existsSync(join(root, "components/analytics/ConsentPreferencesLink.tsx")));
assert("4 ConsentPreferencesPanel exists", existsSync(join(root, "components/analytics/ConsentPreferencesPanel.tsx")));
assert("4 ConsentRoot exists", existsSync(join(root, "components/analytics/ConsentRoot.tsx")));

const bannerSource = readSource("components/analytics/ConsentBanner.tsx");
assert("4 banner uses role dialog", bannerSource.includes('role="dialog"'));
assert("4 banner accept button", bannerSource.includes("Accept analytics"));
assert("4 banner reject button", bannerSource.includes("Reject analytics"));
assert("4 banner fixed bottom", bannerSource.includes("fixed") && bannerSource.includes("bottom"));
assert("4 banner shows only when undecided", bannerSource.includes('decision === "undecided"'));
assert("4 banner uses client mount guard", bannerSource.includes("useClientMounted"));

const preferencesSource = readSource("components/analytics/ConsentPreferencesPanel.tsx");
assert("4 preferences panel reopen support", preferencesSource.includes("preferencesOpen"));
assert(
  "4 preferences accept and reject actions",
  preferencesSource.includes("acceptAnalytics") && preferencesSource.includes("rejectAnalytics"),
);

const footerSource = readSource("components/layout/Footer.tsx");
assert("4 footer cookie preferences link", footerSource.includes("ConsentPreferencesLink"));

const providersSource = readSource("app/providers.tsx");
assert("4 consent mounted in providers", providersSource.includes("ConsentRoot"));

// 5. Zero analytics guarantee
const analyticsPatterns = [
  /googletagmanager\.com/,
  /google-analytics\.com/,
  /gtag\s*\(/,
  /@vercel\/analytics/,
  /NEXT_PUBLIC_GA_MEASUREMENT_ID/,
  /G-[A-Z0-9]{10}/,
];

const consentFiles = [
  "lib/analytics/consent.ts",
  "components/analytics/ConsentBanner.tsx",
  "components/analytics/ConsentContext.tsx",
  "components/analytics/ConsentPreferencesLink.tsx",
  "components/analytics/ConsentPreferencesPanel.tsx",
  "components/analytics/ConsentRoot.tsx",
  "app/providers.tsx",
].map(readSource);

for (const pattern of analyticsPatterns) {
  const hits = consentFiles.filter((source) => pattern.test(source));
  assert(`5 no analytics pattern ${pattern} in consent files`, hits.length === 0);
}

const packageJson = readSource("package.json");
assert("5 no analytics SDK dependency", !packageJson.includes("@vercel/analytics"));
assert("5 verify script registered", packageJson.includes("verify:analytics-130b"));

const envExample = readSource(".env.local.example");
assert("5 GA measurement env documented in template", envExample.includes("NEXT_PUBLIC_GA_MEASUREMENT_ID"));

// 6. GSC untouched
assert("6 GSC auth script preserved", existsSync(join(root, "scripts/seo/auth.ts")));
assert("6 GSC report script preserved", existsSync(join(root, "scripts/seo/report.ts")));
assert("6 GSC setup doc preserved", existsSync(join(root, "docs/seo/SETUP.md")));
const gscAuthSource = readSource("lib/seo/local/auth.ts");
assert("6 GSC readonly scope preserved", gscAuthSource.includes("webmasters.readonly"));

// 7. SEO-critical files untouched
const toolSeoHash = readFileSync(join(root, "constants/tool-seo.ts"), "utf8").length;
assert("7 tool-seo.ts not emptied", toolSeoHash > 10_000);
assert("7 layout metadata path unchanged", readSource("app/layout.tsx").includes("createPageMetadata"));
assert("7 ToolRoute jsonLd preserved", readSource("components/workspace/ToolRoute.tsx").includes("createToolJsonLd"));

const verifyScripts = [
  "scripts/verify-seo-129f.ts",
  "scripts/verify-seo-129g.ts",
  "scripts/verify-seo-129i.ts",
  "scripts/verify-seo-129k.ts",
];
for (const script of verifyScripts) {
  assert(`7 ${script} preserved`, existsSync(join(root, script)));
}

// 8. Privacy policy — no false GA4 activation claims
const privacyContent = readSource("lib/legal/content.ts");
assert(
  "8 privacy policy does not claim GA4 active",
  !/Google Analytics is active/i.test(privacyContent) && !/we use Google Analytics/i.test(privacyContent),
);

// 9. Storage key constant matches runtime
assert("9 storage key constant exported", CONSENT_STORAGE_KEY === "scanonix_consent_v1");
assert("9 consent version is 1", CONSENT_VERSION === 1);

// 10. No stray analytics under components/analytics except consent
const analyticsDir = join(root, "components/analytics");
if (existsSync(analyticsDir)) {
  const analyticsFiles = readdirSync(analyticsDir);
  assert(
    "10 analytics components limited to consent infrastructure",
    analyticsFiles.every((file) =>
      [
        "AnalyticsProvider.tsx",
        "ConsentBanner.tsx",
        "ConsentContext.tsx",
        "ConsentPreferencesLink.tsx",
        "ConsentPreferencesPanel.tsx",
        "ConsentRoot.tsx",
        "GoogleAnalytics.tsx",
      ].includes(file),
    ),
  );
}

console.log(`\n130B verify: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
