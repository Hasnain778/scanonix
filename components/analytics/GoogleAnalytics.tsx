"use client";

import Script from "next/script";
import { useCallback, useEffect } from "react";
import { useConsentDecision } from "@/components/analytics/ConsentContext";
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

export function GoogleAnalytics() {
  const decision = useConsentDecision();
  const measurementId = getMeasurementId();

  const activateAnalytics = useCallback(() => {
    if (!markGaActivationComplete()) return;
    markGaScriptLoaded();
    finishActivation();
  }, []);

  useEffect(() => {
    if (decision !== "accepted" || !measurementId) return;

    // Cached gtag/js may not re-fire onLoad when the Script remounts after re-consent.
    const timer = window.setTimeout(() => {
      const script = document.getElementById("scanonix-ga4") as HTMLScriptElement | null;
      if (!script?.src || script.getAttribute("data-loaded") !== "true") return;
      activateAnalytics();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [decision, measurementId, activateAnalytics]);

  if (!isGaConfigured() || decision !== "accepted" || !measurementId) {
    return null;
  }

  return (
    <>
      <Script
        id="scanonix-ga4-bootstrap"
        strategy="afterInteractive"
        onReady={bootstrapGaBeforeScript}
      >
        {"/* scanonix ga bootstrap */"}
      </Script>
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
    </>
  );
}
