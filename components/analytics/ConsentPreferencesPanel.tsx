"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useClientMounted, useConsent } from "@/components/analytics/ConsentContext";

function preferenceLabel(decision: "undecided" | "accepted" | "rejected"): string {
  if (decision === "accepted") return "Analytics accepted";
  if (decision === "rejected") return "Analytics rejected";
  return "Not yet decided";
}

export function ConsentPreferencesPanel() {
  const mounted = useClientMounted();
  const {
    decision,
    preferencesOpen,
    acceptAnalytics,
    rejectAnalytics,
    closePreferences,
  } = useConsent();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!preferencesOpen) return;

    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePreferences();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [preferencesOpen, closePreferences]);

  if (!mounted || !preferencesOpen) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close cookie preferences"
        className="fixed inset-0 z-[85] bg-black/50 backdrop-blur-[1px]"
        onClick={closePreferences}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-labelledby="consent-preferences-title"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 z-[86] flex justify-center p-3 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-4"
      >
        <div className="w-full rounded-2xl border border-white/10 bg-[#0e0e0e] p-5 shadow-2xl shadow-black/50 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="consent-preferences-title" className="text-base font-semibold text-white">
                Cookie preferences
              </h2>
              <p className="mt-1 text-sm text-scanonix-muted">
                Manage optional analytics cookies for scanonix.com.
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={closePreferences}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-scanonix-muted transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-sm font-medium text-white">Analytics cookies</p>
            <p className="mt-1 text-sm leading-relaxed text-scanonix-muted">
              Help us understand which tools are used so we can improve Scanonix. Document
              contents are never included.
            </p>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-scanonix-muted">
              Current choice:{" "}
              <span className="text-white normal-case">{preferenceLabel(decision)}</span>
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={rejectAnalytics}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/15 bg-transparent px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
            >
              Reject analytics
            </button>
            <button
              type="button"
              onClick={acceptAnalytics}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-scanonix-orange/25 bg-scanonix-orange px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
            >
              Accept analytics
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-scanonix-muted">
            See our{" "}
            <Link
              href="/privacy"
              className="font-medium text-scanonix-orange hover:text-scanonix-orange-light hover:underline"
              onClick={closePreferences}
            >
              Privacy Policy
            </Link>{" "}
            for more information.
          </p>
        </div>
      </div>
    </>
  );
}
