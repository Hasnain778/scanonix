"use client";

import Link from "next/link";
import { useUsageSummary } from "@/hooks/useUsageSummary";

function formatResetDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DashboardUsageSummary() {
  const { summary, loading, error } = useUsageSummary();

  if (loading) {
    return (
      <p className="mt-3 text-sm text-scanonix-muted">Loading usage summary…</p>
    );
  }

  if (error || !summary) {
    return (
      <p className="mt-3 text-sm text-scanonix-muted">
        Sign in to view your usage summary.
      </p>
    );
  }

  const exhausted = summary.remaining <= 0;

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-scanonix-muted">
            Operations used
          </p>
          <p className="mt-1 text-2xl font-bold text-white">{summary.usageCount}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-scanonix-muted">
            Remaining
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${
              exhausted ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {summary.remaining}
          </p>
        </div>
      </div>

      <dl className="grid gap-2 text-sm text-scanonix-muted sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide">Plan limit</dt>
          <dd className="mt-0.5 font-medium text-white">{summary.limit} operations</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide">Resets</dt>
          <dd className="mt-0.5 font-medium text-white">
            {formatResetDate(summary.resetAt)}
          </dd>
        </div>
      </dl>

      {exhausted ? (
        <p className="text-sm text-red-300">
          Limit reached.{" "}
          <Link href="/pricing" className="font-semibold text-scanonix-orange hover:underline">
            Upgrade your plan
          </Link>{" "}
          for more operations.
        </p>
      ) : (
        <p className="text-xs text-scanonix-muted/80">
          Usage is enforced on the server for every tool operation.
        </p>
      )}
    </div>
  );
}
