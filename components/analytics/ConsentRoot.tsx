"use client";

import { type ReactNode } from "react";
import { ConsentBanner } from "@/components/analytics/ConsentBanner";
import { ConsentProvider } from "@/components/analytics/ConsentContext";
import { ConsentPreferencesPanel } from "@/components/analytics/ConsentPreferencesPanel";

export function ConsentRoot({ children }: { children: ReactNode }) {
  return (
    <ConsentProvider>
      {children}
      <ConsentBanner />
      <ConsentPreferencesPanel />
    </ConsentProvider>
  );
}
