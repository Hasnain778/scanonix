"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useClientMounted, useConsentDecision } from "@/components/analytics/ConsentContext";
import {
  isGaConfigured,
  isGaReady,
  subscribeToGaReady,
  trackPageView,
} from "@/lib/analytics/ga4";

function buildRouteKey(pathname: string, searchParams: URLSearchParams | null): string {
  const search = searchParams?.toString();
  return search ? `${pathname}?${search}` : pathname;
}

function AnalyticsPageViewsInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const decision = useConsentDecision();
  const mounted = useClientMounted();
  const search = searchParams?.toString() ?? "";

  useEffect(() => {
    if (!mounted || decision !== "accepted" || !isGaConfigured()) return;

    const routeKey = buildRouteKey(pathname, searchParams);

    function attemptTrack(): void {
      trackPageView(routeKey);
    }

    if (isGaReady()) {
      attemptTrack();
      return;
    }

    return subscribeToGaReady(attemptTrack);
  }, [mounted, decision, pathname, search, searchParams]);

  return null;
}

export function AnalyticsProvider() {
  return (
    <Suspense fallback={null}>
      <AnalyticsPageViewsInner />
    </Suspense>
  );
}
