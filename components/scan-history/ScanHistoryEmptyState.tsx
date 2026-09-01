"use client";

import { ErrorState } from "@/components/common/ErrorState";
import { ActionButton } from "@/components/ui/ActionButton";

export function ScanHistoryEmptyState() {
  return (
    <section
      className="surface-card px-6 py-14 text-center sm:py-16"
      aria-labelledby="scan-history-empty-heading"
    >
      <div
        className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-muted text-scanonix-orange"
        aria-hidden="true"
      >
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </div>
      <h2 id="scan-history-empty-heading" className="text-section-title text-xl">
        No scans yet
      </h2>
      <p className="text-body mx-auto mt-3 max-w-md">
        Start your first security scan to see results here.
      </p>
      <ActionButton href="/tools/security-scan" size="lg" className="mt-6">
        Start new scan
      </ActionButton>
    </section>
  );
}

export function ScanHistoryErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorState
      title="Could not load scan history"
      message="We couldn't reach your scan data. Check your connection and try again."
      onRetry={onRetry}
      retryLabel="Retry"
    />
  );
}
