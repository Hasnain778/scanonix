"use client";

import { type ReactNode } from "react";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { ConsentBanner } from "@/components/analytics/ConsentBanner";
import { ConsentProvider } from "@/components/analytics/ConsentContext";
import { ConsentPreferencesPanel } from "@/components/analytics/ConsentPreferencesPanel";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";

export function ConsentRoot({ children }: { children: ReactNode }) {
  return (
    <ConsentProvider>
      {children}
      <GoogleAnalytics />
      <AnalyticsProvider />
      <ConsentBanner />
      <ConsentPreferencesPanel />
    </ConsentProvider>
  );
}
