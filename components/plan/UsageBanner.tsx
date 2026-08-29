"use client";

import Link from "next/link";
import { ANALYTICS_SURFACES } from "@/lib/analytics/surfaces";
import { trackEvent } from "@/lib/analytics/ga4";
import type { UsageSummaryResponse } from "@/lib/plan/client";

interface UsageBannerProps {
  summary: UsageSummaryResponse | null;
  loading?: boolean;
  className?: string;
}

function formatResetDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function UsageBanner({ summary, loading = false, className = "" }: UsageBannerProps) {
  if (loading) {
    return (
      <div
        className={`rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-foreground-muted shadow-[var(--shadow-soft)] ${className}`}
      >
        Loading usage…
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const exhausted = summary.remaining <= 0;

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm shadow-[var(--shadow-soft)] ${
        exhausted
          ? "border-red-500/35 bg-red-500/10 text-foreground"
          : "border-border bg-surface-raised text-foreground-muted"
      } ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-semibold capitalize text-foreground">{summary.plan}</span>
          {" · "}
          <span className={exhausted ? "text-foreground" : "text-foreground-secondary"}>
            {summary.usageCount} / {summary.limit} operations used
          </span>
          {" · "}
          {summary.remaining} remaining
        </p>
        <p className="text-xs text-foreground-muted">Resets {formatResetDate(summary.resetAt)}</p>
      </div>
      {exhausted ? (
        <p className="mt-2 text-xs">
          Limit reached.{" "}
          <Link
            href="/pricing"
            onClick={() => {
              trackEvent("upgrade_click", {
                source_surface: ANALYTICS_SURFACES.USAGE_BANNER,
                tier: "pro",
              });
            }}
            className="font-semibold text-scanonix-orange hover:underline"
          >
            Upgrade your plan
          </Link>{" "}
          for more operations.
        </p>
      ) : null}
    </div>
  );
}

export function UpgradeRequiredNotice({ feature }: { feature: string }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      {feature} requires Pro or Business.{" "}
      <Link
        href="/pricing"
        onClick={() => {
          trackEvent("upgrade_click", {
            source_surface: ANALYTICS_SURFACES.USAGE_BANNER,
            tier: "pro",
          });
        }}
        className="font-semibold text-scanonix-orange hover:underline"
      >
        Upgrade required
      </Link>
    </div>
  );
}
