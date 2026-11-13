"use client";

import Script from "next/script";
import { useCallback, useEffect } from "react";
import { useConsentDecision } from "@/components/analytics/ConsentContext";
import { isAnalyticsConsentGranted } from "@/lib/analytics/consent";
import {
  bootstrapGaBeforeScript,
  getGtagJsUrl,
  getMeasurementId,
  isGaConfigured,
  markGaActivationComplete,
  markGaReady,
  markGaScriptLoaded,
  refreshGrantedAnalytics,
} from "@/lib/analytics/ga4";

function finishActivation(): void {
  refreshGrantedAnalytics();
  window.setTimeout(() => {
    markGaReady();
  }, 0);
}

function gtagScriptElement(): HTMLScriptElement | null {
  return document.getElementById("scanonix-ga4") as HTMLScriptElement | null;
}

export function GoogleAnalytics() {
  const decision = useConsentDecision();
  const measurementId = getMeasurementId();

  const activateAnalytics = useCallback(() => {
    if (!isAnalyticsConsentGranted()) return;
    if (!markGaActivationComplete()) return;
    markGaScriptLoaded();
    finishActivation();
  }, []);

  const allowExternalScript =
    isGaConfigured() && decision === "accepted" && measurementId.length > 0;

  useEffect(() => {
    if (!allowExternalScript) return;

    const existing = gtagScriptElement();
    if (existing?.getAttribute("data-loaded") === "true") {
      activateAnalytics();
    }
  }, [allowExternalScript, activateAnalytics]);

  useEffect(() => {
    if (!allowExternalScript) return;

    // Cached gtag/js may not re-fire onLoad when the Script remounts after re-consent.
    const timer = window.setTimeout(() => {
      const script = gtagScriptElement();
      if (!script?.src || script.getAttribute("data-loaded") !== "true") return;
      activateAnalytics();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [allowExternalScript, activateAnalytics]);

  if (!isGaConfigured() || decision !== "accepted" || !measurementId) {
    return null;
  }

  // Queue the denied default and analytics update before this render creates the gtag.js tag.
  bootstrapGaBeforeScript();

  return (
    <>
      <Script
        id="scanonix-ga4-bootstrap"
        strategy="afterInteractive"
        onReady={bootstrapGaBeforeScript}
      >
        {"/* scanonix ga bootstrap */"}
      </Script>
      {allowExternalScript ? (
        <Script
          id="scanonix-ga4"
          src={getGtagJsUrl(measurementId)}
          strategy="afterInteractive"
          onLoad={() => {
            const script = document.getElementById("scanonix-ga4");
            script?.setAttribute("data-loaded", "true");
            activateAnalytics();
          }}
        />
      ) : null}
    </>
  );
}
