/**
 * GA4 consent sequencing. Run from the release worktree:
 * npx --yes tsx scripts/verify-ga4-consent-sequence.ts
 *
 * Uses a fake measurement ID and never loads gtag.js.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TESTCONSENT1";

type ConsentCommandParams = {
  analytics_storage?: string;
  ad_storage?: string;
  ad_user_data?: string;
  ad_personalization?: string;
  send_page_view?: boolean;
};

type Command = {
  command: string;
  name: string;
  params: ConsentCommandParams | undefined;
};

const store = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

const documentMock = {
  title: "OCR",
  cookie: "",
  getElementById(): null {
    return null;
  },
  querySelectorAll(): unknown[] {
    return [];
  },
};

const windowMock: Record<string, unknown> = {
  dataLayer: [] as unknown[],
  location: {
    href: "https://www.scanonix.com/tools/ocr",
    origin: "https://www.scanonix.com",
    hostname: "www.scanonix.com",
    pathname: "/tools/ocr",
  },
  document: documentMock,
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  },
  addEventListener(type: string, fn: () => void) {
    const set = listeners.get(type) ?? new Set<() => void>();
    set.add(fn);
    listeners.set(type, set);
  },
  removeEventListener(type: string, fn: () => void) {
    listeners.get(type)?.delete(fn);
  },
  dispatchEvent(event: { type: string }) {
    listeners.get(event.type)?.forEach((fn) => fn());
    return true;
  },
};

Object.assign(globalThis, {
  window: windowMock,
  document: documentMock,
  localStorage: windowMock.localStorage,
});

const DENIED = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

const ANALYTICS_GRANTED = {
  analytics_storage: "granted",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`✓ ${name}`);
    return;
  }
  failed += 1;
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function commands(): Command[] {
  const dataLayer = windowMock.dataLayer as { 0?: unknown; 1?: unknown; 2?: unknown }[];
  return dataLayer.map((entry) => ({
    command: String(entry[0] ?? ""),
    name: String(entry[1] ?? ""),
    params: entry[2] as ConsentCommandParams | undefined,
  }));
}

function sameConsent(
  actual: ConsentCommandParams | undefined,
  expected: ConsentCommandParams,
): boolean {
  if (!actual) return false;
  return (
    actual.analytics_storage === expected.analytics_storage &&
    actual.ad_storage === expected.ad_storage &&
    actual.ad_user_data === expected.ad_user_data &&
    actual.ad_personalization === expected.ad_personalization
  );
}

async function main(): Promise<void> {
const ga4 = await import("../lib/analytics/ga4");
const consent = await import("../lib/analytics/consent");

const root = process.cwd();
const ga4Source = readFileSync(join(root, "lib/analytics/ga4.ts"), "utf8");
const componentSource = readFileSync(join(root, "components/analytics/GoogleAnalytics.tsx"), "utf8");

const defaultAt = ga4Source.indexOf('gtag("consent", "default", CONSENT_DENIED)');
const updateAfterDefault = ga4Source.indexOf(
  'gtag("consent", "update", CONSENT_GRANTED)',
  defaultAt,
);
const configAfterUpdate = ga4Source.indexOf(
  "ensureMeasurementConfigured(measurementId)",
  updateAfterDefault,
);
assert(
  "source queues denied default before the analytics update",
  defaultAt >= 0 && updateAfterDefault > defaultAt && configAfterUpdate > updateAfterDefault,
);
assert(
  "source does not default analytics to granted",
  !ga4Source.includes('gtag("consent", "default", CONSENT_GRANTED)'),
);
assert("source never grants advertising storage", !ga4Source.includes('ad_storage: "granted"'));
assert(
  "component queues consent before the external script is allowed",
  componentSource.indexOf("bootstrapGaBeforeScript();") <
    componentSource.indexOf('id="scanonix-ga4"'),
);
assert(
  "component renders gtag.js only after that allow flag",
  componentSource.indexOf("allowExternalScript ?") < componentSource.indexOf('id="scanonix-ga4"'),
);
assert(
  "component still withholds GA unless analytics was accepted",
  componentSource.includes('decision !== "accepted"'),
);

assert(
  "1 new visitor has no queued commands",
  commands().length === 0,
);

consent.rejectAnalyticsConsent();
assert("3 reject before any tag does not create a gtag command", commands().length === 0);
assert("3 reject stores analytics false", consent.getConsentDecision() === "rejected");

consent.acceptAnalyticsConsent();
ga4.bootstrapGaBeforeScript();
const queued = commands();
assert("2 first command is consent default", queued[0]?.command === "consent" && queued[0]?.name === "default");
assert("2 default denies analytics and ads", sameConsent(queued[0]?.params, DENIED));
assert("2 second command is consent update", queued[1]?.command === "consent" && queued[1]?.name === "update");
assert("2 update grants analytics only", sameConsent(queued[1]?.params, ANALYTICS_GRANTED));
assert("2 third command is js", queued[2]?.command === "js");
assert("2 fourth command is config", queued[3]?.command === "config" && queued[3]?.name === "G-TESTCONSENT1");
assert(
  "2 config does not send an automatic page view",
  queued[3]?.params?.send_page_view === false,
);
assert("2 exactly one config", queued.filter((entry) => entry.command === "config").length === 1);

const afterFirst = commands().length;
ga4.bootstrapGaBeforeScript();
assert("2 repeat bootstrap does not queue another command", commands().length === afterFirst);

ga4.markGaScriptLoaded();
ga4.markGaActivationComplete();
ga4.markGaReady();
assert("4 accepted reload path sends one page view", ga4.trackPageView("/tools/ocr") === "sent");
assert("4 same route does not send a second page view", ga4.trackPageView("/tools/ocr") === "skipped");
assert(
  "4 one page_view command",
  commands().filter((entry) => entry.command === "event" && entry.name === "page_view").length === 1,
);

consent.rejectAnalyticsConsent();
const afterReject = commands();
const lastAfterReject = afterReject[afterReject.length - 1];
assert("6 reject updates consent to denied", lastAfterReject?.command === "consent" && lastAfterReject?.name === "update");
assert("6 reject denies analytics and ads", sameConsent(lastAfterReject?.params, DENIED));
assert("6 reject does not add another config", afterReject.filter((entry) => entry.command === "config").length === 1);
assert("5 stored rejection is rejected", consent.getConsentDecision() === "rejected");

consent.acceptAnalyticsConsent();
ga4.bootstrapGaBeforeScript();
const afterReaccept = commands();
const lastAfterReaccept = afterReaccept[afterReaccept.length - 1];
assert(
  "7 re-accept sends an update, not a second default",
  lastAfterReaccept?.command === "consent" && lastAfterReaccept?.name === "update",
);
assert("7 re-accept grants analytics only", sameConsent(lastAfterReaccept?.params, ANALYTICS_GRANTED));
assert(
  "7 re-accept does not queue another default or config",
  afterReaccept.filter((entry) => entry.command === "consent" && entry.name === "default").length === 1 &&
    afterReaccept.filter((entry) => entry.command === "config").length === 1,
);

ga4.markGaScriptLoaded();
ga4.markGaActivationComplete();
ga4.markGaReady();
assert("8 re-accept does not send another page view for the same route", ga4.trackPageView("/tools/ocr") === "skipped");

for (let i = 0; i < 5; i += 1) {
  consent.rejectAnalyticsConsent();
  consent.acceptAnalyticsConsent();
  ga4.bootstrapGaBeforeScript();
  ga4.markGaScriptLoaded();
  ga4.markGaActivationComplete();
  ga4.markGaReady();
  ga4.trackPageView("/tools/ocr");
}

const finalCommands = commands();
assert(
  "8 rapid toggles keep a single default",
  finalCommands.filter((entry) => entry.command === "consent" && entry.name === "default").length === 1,
);
assert(
  "8 rapid toggles keep a single config",
  finalCommands.filter((entry) => entry.command === "config").length === 1,
);
assert(
  "8 rapid toggles keep a single page view",
  finalCommands.filter((entry) => entry.command === "event" && entry.name === "page_view").length === 1,
);
assert(
  "8 no consent command grants advertising storage",
  finalCommands
    .filter((entry) => entry.command === "consent")
    .every(
      (entry) =>
        entry.params?.ad_storage === "denied" &&
        entry.params?.ad_user_data === "denied" &&
        entry.params?.ad_personalization === "denied",
    ),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
}

void main();
