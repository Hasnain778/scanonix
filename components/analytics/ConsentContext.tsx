"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  acceptAnalyticsConsent,
  CONSENT_CHANGE_EVENT,
  getConsentDecision,
  rejectAnalyticsConsent,
  type ConsentDecision,
} from "@/lib/analytics/consent";

interface ConsentContextValue {
  decision: ConsentDecision;
  preferencesOpen: boolean;
  acceptAnalytics: () => void;
  rejectAnalytics: () => void;
  openPreferences: () => void;
  closePreferences: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

function subscribeToConsent(callback: () => void): () => void {
  window.addEventListener(CONSENT_CHANGE_EVENT, callback);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, callback);
}

function getConsentSnapshot(): ConsentDecision {
  return getConsentDecision();
}

function getConsentServerSnapshot(): ConsentDecision {
  return "undecided";
}

export function useConsentDecision(): ConsentDecision {
  return useSyncExternalStore(
    subscribeToConsent,
    getConsentSnapshot,
    getConsentServerSnapshot,
  );
}

export function useClientMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const decision = useConsentDecision();
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const acceptAnalytics = useCallback(() => {
    acceptAnalyticsConsent();
    setPreferencesOpen(false);
  }, []);

  const rejectAnalytics = useCallback(() => {
    rejectAnalyticsConsent();
    setPreferencesOpen(false);
  }, []);

  const openPreferences = useCallback(() => {
    setPreferencesOpen(true);
  }, []);

  const closePreferences = useCallback(() => {
    setPreferencesOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      decision,
      preferencesOpen,
      acceptAnalytics,
      rejectAnalytics,
      openPreferences,
      closePreferences,
    }),
    [
      decision,
      preferencesOpen,
      acceptAnalytics,
      rejectAnalytics,
      openPreferences,
      closePreferences,
    ],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error("useConsent must be used within ConsentProvider");
  }
  return context;
}
