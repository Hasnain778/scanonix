"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useClientMounted, useConsentDecision } from "@/components/analytics/ConsentContext";
import {
  isGaConfigured,
  isGaReady,
  subscribeToGaReady,
  trackPageView,
} from "@/lib/analytics/ga4";

function AnalyticsPageViews() {
  const pathname = usePathname();
  const decision = useConsentDecision();
  const mounted = useClientMounted();

  useEffect(() => {
    if (!mounted || decision !== "accepted" || !isGaConfigured()) return;
    if (!pathname) return;

    function attemptTrack(): void {
      // Pathname only — query/hash never enter GA4 page_view (sanitized again in ga4).
      trackPageView(pathname);
    }

    if (isGaReady()) {
      attemptTrack();
      return;
    }

    return subscribeToGaReady(attemptTrack);
  }, [mounted, decision, pathname]);

  return null;
}

export function AnalyticsProvider() {
  return <AnalyticsPageViews />;
}
