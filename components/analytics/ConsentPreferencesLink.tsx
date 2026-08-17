"use client";

import { useConsent } from "@/components/analytics/ConsentContext";

interface ConsentPreferencesLinkProps {
  className?: string;
}

export function ConsentPreferencesLink({
  className = "text-sm text-scanonix-muted transition-colors duration-200 hover:text-scanonix-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40 rounded",
}: ConsentPreferencesLinkProps) {
  const { openPreferences } = useConsent();

  return (
    <button type="button" onClick={openPreferences} className={className}>
      Cookie preferences
    </button>
  );
}
