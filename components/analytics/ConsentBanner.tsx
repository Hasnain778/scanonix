"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useClientMounted, useConsent } from "@/components/analytics/ConsentContext";

export function ConsentBanner() {
  const mounted = useClientMounted();
  const { decision, acceptAnalytics, rejectAnalytics } = useConsent();
  const acceptRef = useRef<HTMLButtonElement>(null);

  const showBanner = mounted && decision === "undecided";

  useEffect(() => {
    if (showBanner) {
      acceptRef.current?.focus();
    }
  }, [showBanner]);

  if (!showBanner) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-labelledby="consent-banner-title"
      aria-describedby="consent-banner-description"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center p-3 sm:p-4"
    >
      <div className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-border bg-surface-raised/95 p-4 shadow-2xl backdrop-blur-md sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1">
            <p
              id="consent-banner-title"
              className="text-sm font-semibold text-foreground sm:text-base"
            >
              Cookie preferences
            </p>
            <p
              id="consent-banner-description"
              className="mt-1.5 text-sm leading-relaxed text-scanonix-muted"
            >
              We use optional analytics cookies to understand how Scanonix is used and improve
              our tools. No document content is sent to analytics.{" "}
              <Link
                href="/privacy"
                className="font-medium text-scanonix-orange underline-offset-2 hover:text-scanonix-orange-light hover:underline"
              >
                Privacy Policy
              </Link>
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={rejectAnalytics}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-transparent px-5 py-2.5 text-sm font-semibold text-foreground transition hover:border-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
            >
              Reject analytics
            </button>
            <button
              ref={acceptRef}
              type="button"
              onClick={acceptAnalytics}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-scanonix-orange/25 bg-scanonix-orange px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
            >
              Accept analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
