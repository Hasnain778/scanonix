/**
 * GA4 helpers (Phase 130C Step 2).
 * Client-only — never import side effects on the server.
 */

import { getGaMeasurementId } from "@/config/env.public";
import { isAnalyticsConsentGranted } from "@/lib/analytics/consent";
import {
  type CustomEventName,
  type CustomEventParamsMap,
  sanitizeCustomEvent,
} from "@/lib/analytics/events";

export type { CustomEventName, CustomEventParamsMap } from "@/lib/analytics/events";

export const GA_READY_EVENT = "scanonix-ga-ready";

/**
 * Human GA Admin (130C Step 2): In GA4 Enhanced Measurement, disable ONLY
 * "Page views" → "Page changes based on browser history events".
 * Scanonix sends manual App Router page_view events; history-based EM duplicates them.
 * Keep other Enhanced Measurement events (scrolls, outbound clicks, file downloads) enabled.
 */
export const GA_ADMIN_DISABLE_EM_HISTORY_PAGEVIEWS =
  "Disable Enhanced Measurement page views from browser history events";

/** Google-documented gtag.js loader URL with env-driven measurement ID. */
export function getGtagJsUrl(measurementId?: string): string {
  const id = (measurementId ?? getMeasurementId()).trim();
  return `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
}

type GtagCommand = "js" | "config" | "consent" | "event" | "set";

type ConsentParams = {
  analytics_storage?: "granted" | "denied";
  ad_storage?: "granted" | "denied";
  ad_user_data?: "granted" | "denied";
  ad_personalization?: "granted" | "denied";
};

type GtagFn = {
  (...args: unknown[]): void;
  __scanonixStub?: boolean;
};

export interface ScanonixGaRuntime {
  bootstrapComplete: boolean;
  scriptRequested: boolean;
  scriptLoaded: boolean;
  ready: boolean;
  activationComplete: boolean;
  configuredMeasurementIds: Record<string, true>;
  lastSentRouteKey: string | null;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
    __scanonixGaRuntime?: ScanonixGaRuntime;
  }
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function debugLog(message: string, detail?: string): void {
  if (process.env.NODE_ENV !== "development" || !isBrowser()) return;
  console.debug(`[scanonix-ga] ${message}${detail ? `: ${detail}` : ""}`);
}

function gaRuntime(): ScanonixGaRuntime {
  if (!isBrowser()) {
    return {
      bootstrapComplete: false,
      scriptRequested: false,
      scriptLoaded: false,
      ready: false,
      activationComplete: false,
      configuredMeasurementIds: {},
      lastSentRouteKey: null,
    };
  }

  window.__scanonixGaRuntime ??= {
    bootstrapComplete: false,
    scriptRequested: false,
    scriptLoaded: false,
    ready: false,
    activationComplete: false,
    configuredMeasurementIds: {},
    lastSentRouteKey: null,
  };

  return window.__scanonixGaRuntime;
}

function dataLayerEntryLabel(entry: unknown): string {
  if (entry == null) return "unknown";
  const args = entry as { 0?: unknown; 1?: unknown; 2?: unknown };
  const command = String(args[0] ?? "?");
  if (command === "config") return `config:${String(args[1] ?? "?")}`;
  if (command === "event") return `event:${String(args[1] ?? "?")}`;
  if (command === "consent") return `consent:${String(args[1] ?? "?")}`;
  return command;
}

export function debugLogDataLayer(context: string): void {
  if (process.env.NODE_ENV !== "development" || !isBrowser()) return;

  const rt = gaRuntime();
  const entries = (window.dataLayer ?? []).map(dataLayerEntryLabel);
  const configIds = entries.filter((e) => e.startsWith("config:"));
  const pageViews = entries.filter((e) => e === "event:page_view");
  const scriptCount = document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').length;

  debugLog(
    "dataLayer forensics",
    [
      `ctx=${context}`,
      `entries=${entries.length}`,
      `configs=[${configIds.join(",")}]`,
      `pageViews=${pageViews.length}`,
      `configuredIds=[${Object.keys(rt.configuredMeasurementIds).join(",")}]`,
      `gtagScripts=${scriptCount}`,
      `bootstrap=${rt.bootstrapComplete}`,
      `loaded=${rt.scriptLoaded}`,
      `ready=${rt.ready}`,
    ].join(" "),
  );
}

export function getMeasurementId(): string {
  return getGaMeasurementId();
}

export function isGaConfigured(): boolean {
  return getMeasurementId().length > 0;
}

export function initDataLayer(): void {
  if (!isBrowser()) return;
  window.dataLayer = window.dataLayer ?? [];

  const existing = window.gtag;
  if (typeof existing === "function" && !existing.__scanonixStub) {
    return;
  }

  const gtag = function gtagStub() {
    // gtag.js requires `arguments` objects in dataLayer — not rest-param arrays.
    // eslint-disable-next-line prefer-rest-params -- Google gtag contract
    window.dataLayer!.push(arguments);
  } as GtagFn;
  gtag.__scanonixStub = true;
  window.gtag = gtag;
}

export function gtag(...args: [GtagCommand, ...unknown[]]): void {
  if (!isBrowser() || typeof window.gtag !== "function") return;
  window.gtag(...args);
}

const CONSENT_DENIED: ConsentParams = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

const CONSENT_GRANTED: ConsentParams = {
  analytics_storage: "granted",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

const GA_CONFIG = {
  send_page_view: false,
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
} as const;

type GaDisableWindow = Window & Record<string, boolean | undefined>;

function gaDisableWindow(): GaDisableWindow {
  return window as unknown as GaDisableWindow;
}

export function setGaDisabled(measurementId: string, disabled: boolean): void {
  if (!isBrowser() || !measurementId) return;
  gaDisableWindow()[`ga-disable-${measurementId}`] = disabled;
}

export function enableAnalyticsTracking(): void {
  const measurementId = getMeasurementId();
  if (!measurementId) return;
  setGaDisabled(measurementId, false);
}

function ensureMeasurementConfigured(measurementId: string): boolean {
  const rt = gaRuntime();
  if (rt.configuredMeasurementIds[measurementId]) {
    debugLog("config skipped", `measurementId=${measurementId} reason=already-configured`);
    return false;
  }

  gtag("config", measurementId, GA_CONFIG);
  rt.configuredMeasurementIds[measurementId] = true;
  debugLog("config applied", `measurementId=${measurementId}`);
  return true;
}

export function markGaScriptRequested(): void {
  if (!isBrowser()) return;
  gaRuntime().scriptRequested = true;
}

export function isGaScriptRequested(): boolean {
  return gaRuntime().scriptRequested;
}

export function markGaScriptLoaded(): void {
  if (!isBrowser()) return;
  const rt = gaRuntime();
  if (rt.scriptLoaded) return;
  rt.scriptLoaded = true;
  debugLog("script loaded");
  debugLogDataLayer("after-script-load");
}

export function isGaScriptLoaded(): boolean {
  return gaRuntime().scriptLoaded;
}

export function isGaReady(): boolean {
  return isBrowser() && gaRuntime().ready;
}

export function resetPageViewDedupe(): void {
  gaRuntime().lastSentRouteKey = null;
  debugLog("page_view dedupe reset");
}

export function getLastSentRouteKey(): string | null {
  return gaRuntime().lastSentRouteKey;
}

/** Soft reset on withdrawal — preserves configured destinations to avoid stacking config on re-enable. */
export function resetGaRuntimeState(): void {
  if (!isBrowser()) return;
  const rt = gaRuntime();
  rt.ready = false;
  rt.activationComplete = false;
  rt.lastSentRouteKey = null;
  debugLog("runtime state reset (config destinations preserved)");
}

/** Queue consent + config in dataLayer before gtag.js downloads (Google canonical order). */
export function bootstrapGaBeforeScript(): void {
  const measurementId = getMeasurementId();
  if (!measurementId || !isBrowser()) return;

  const rt = gaRuntime();
  if (rt.bootstrapComplete) {
    debugLog("bootstrap skipped", "reason=already-complete");
    return;
  }

  initDataLayer();
  enableAnalyticsTracking();
  gtag("consent", "default", CONSENT_GRANTED);
  gtag("js", new Date());
  ensureMeasurementConfigured(measurementId);

  rt.bootstrapComplete = true;
  debugLog("bootstrap", "dataLayer configured before gtag.js");
  debugLogDataLayer("after-bootstrap");
}

export function disableAnalyticsTracking(): void {
  const measurementId = getMeasurementId();
  if (!measurementId) return;

  setGaDisabled(measurementId, true);
  resetGaRuntimeState();

  if (typeof window.gtag === "function") {
    gtag("consent", "update", CONSENT_DENIED);
  }
}

/** Re-grant consent when gtag.js is already present (re-enable / cached script). Never stacks config. */
export function refreshGrantedAnalytics(): void {
  const measurementId = getMeasurementId();
  if (!measurementId || !isBrowser() || !gaRuntime().scriptLoaded) return;

  initDataLayer();
  enableAnalyticsTracking();

  if (!gaRuntime().bootstrapComplete) {
    bootstrapGaBeforeScript();
    return;
  }

  gtag("consent", "update", CONSENT_GRANTED);
  debugLog("config", "consent refreshed after script load (no duplicate config)");
  debugLogDataLayer("after-consent-refresh");
}

export function markGaReady(): void {
  if (!isBrowser()) return;
  const rt = gaRuntime();
  if (!rt.scriptLoaded || !rt.bootstrapComplete) return;
  if (rt.ready) {
    debugLog("ready skipped", "reason=already-ready");
    return;
  }

  rt.ready = true;
  debugLog("ready");
  debugLogDataLayer("after-ready");
  window.dispatchEvent(new CustomEvent(GA_READY_EVENT));
}

export function markGaActivationComplete(): boolean {
  if (!isBrowser()) return false;
  const rt = gaRuntime();
  if (rt.activationComplete) return false;
  rt.activationComplete = true;
  return true;
}

export function subscribeToGaReady(callback: () => void): () => void {
  if (!isBrowser()) return () => {};

  const handler = () => callback();
  window.addEventListener(GA_READY_EVENT, handler);
  return () => window.removeEventListener(GA_READY_EVENT, handler);
}

export function isGtagAvailable(): boolean {
  return isBrowser() && typeof window.gtag === "function";
}

function isGaDisabledForMeasurement(measurementId: string): boolean {
  return Boolean(gaDisableWindow()[`ga-disable-${measurementId}`]);
}

/** True when custom events may be sent (consent + GA ready + configured + not disabled). */
export function canSendCustomAnalyticsEvent(): boolean {
  if (!isBrowser()) return false;
  if (!isAnalyticsConsentGranted()) return false;
  if (!isGaConfigured() || !isGaReady() || !isGtagAvailable()) return false;
  const measurementId = getMeasurementId();
  if (!measurementId || isGaDisabledForMeasurement(measurementId)) return false;
  return true;
}

/**
 * Consent-safe custom GA4 event sender (Phase 130D Step 2A).
 * Drops events when analytics is not ready — never queues for later.
 * No operation-level dedupe; repeated legitimate runs may emit multiple events.
 */
export function trackEvent<E extends CustomEventName>(
  eventName: E,
  parameters: CustomEventParamsMap[E],
): "sent" | "dropped" {
  if (!canSendCustomAnalyticsEvent()) {
    debugLog("custom_event dropped", `event=${eventName} reason=not-ready-or-blocked`);
    return "dropped";
  }

  const sanitized = sanitizeCustomEvent(eventName, parameters);
  if (!sanitized.ok) {
    debugLog("custom_event dropped", `event=${eventName} reason=${sanitized.reason}`);
    return "dropped";
  }

  const measurementId = getMeasurementId();
  if (isGaDisabledForMeasurement(measurementId)) {
    debugLog("custom_event dropped", `event=${eventName} reason=ga-disable`);
    return "dropped";
  }

  gtag("event", sanitized.eventName, {
    ...sanitized.params,
    send_to: measurementId,
  });

  debugLog("custom_event sent", `event=${sanitized.eventName}`);
  debugLogDataLayer(`after-custom-event-${sanitized.eventName}`);
  return "sent";
}

function dispatchPageViewEvent(pagePath: string, measurementId: string): void {
  if (!isGaReady() || !isGtagAvailable()) return;
  if (gaDisableWindow()[`ga-disable-${measurementId}`]) {
    debugLog("page_view blocked", "ga-disable flag true");
    return;
  }

  gtag("event", "page_view", {
    page_path: pagePath,
    page_location: window.location.href,
    page_title: document.title,
    send_to: measurementId,
  });

  debugLogDataLayer("after-page-view-event");
}

/** Canonical deduped page_view sender — one gtag event per route key per analytics session. */
export function trackPageView(routeKey: string): "sent" | "skipped" {
  if (!routeKey || !isGaReady() || !isGaConfigured()) {
    debugLog("page_view skipped", `routeKey=${routeKey} reason=not-ready`);
    return "skipped";
  }

  const rt = gaRuntime();
  const previous = rt.lastSentRouteKey;
  if (previous === routeKey) {
    debugLog("page_view skipped", `routeKey=${routeKey} reason=dedupe previous=${previous}`);
    return "skipped";
  }

  const measurementId = getMeasurementId();
  debugLog("page_view requested", `routeKey=${routeKey} previous=${previous ?? "none"} configs=${Object.keys(rt.configuredMeasurementIds).length}`);
  rt.lastSentRouteKey = routeKey;
  dispatchPageViewEvent(routeKey, measurementId);
  debugLog("page_view sent", `routeKey=${routeKey}`);
  return "sent";
}

/** @deprecated Use trackPageView — retained for verification references. */
export function sendPageView(pagePath: string): void {
  trackPageView(pagePath);
}

export function clearGaCookies(): void {
  if (!isBrowser() || !window.location?.hostname) return;

  const hostname = window.location.hostname;
  const domains = [undefined, hostname, `.${hostname}`];

  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (!name || (name !== "_ga" && !name.startsWith("_ga_"))) continue;

    for (const domain of domains) {
      const domainPart = domain ? `; domain=${domain}` : "";
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainPart}`;
    }
  }
}
