"use client";

import { useEffect, useState } from "react";
import { BillingPanel } from "@/components/billing/BillingPanels";
import { ActionButton } from "@/components/ui/ActionButton";
import { AccountCard } from "@/components/account/AccountFormField";
import { fetchUsageSummary, type UsageSummaryResponse } from "@/lib/plan/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { getEffectivePlan } from "@/lib/auth/entitlements";

function UsageSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="h-4 w-32 rounded bg-white/10" />
      <div className="h-3 w-full rounded bg-white/5" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-16 rounded-xl bg-white/5" />
        <div className="h-16 rounded-xl bg-white/5" />
        <div className="h-16 rounded-xl bg-white/5" />
      </div>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function UsageOverview({ usage }: { usage: UsageSummaryResponse }) {
  const usedPercent = usage.limit > 0 ? Math.min(100, (usage.usageCount / usage.limit) * 100) : 0;

  return (
    <dl className="space-y-4 text-sm">
      <div className="flex items-start justify-between gap-4">
        <dt className="text-scanonix-muted">Usage this period</dt>
        <dd className="font-semibold text-white">
          {usage.usageCount} / {usage.limit}
        </dd>
      </div>
      <div>
        <div
          className="h-2 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={usage.usageCount}
          aria-valuemin={0}
          aria-valuemax={usage.limit}
          aria-label="Tool usage this billing period"
        >
          <div
            className="h-full rounded-full bg-scanonix-orange transition-all"
            style={{ width: `${usedPercent}%` }}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <dt className="text-xs uppercase tracking-wide text-scanonix-muted">Remaining</dt>
          <dd className="mt-1 text-2xl font-bold text-white">{usage.remaining}</dd>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <dt className="text-xs uppercase tracking-wide text-scanonix-muted">Resets</dt>
          <dd className="mt-1 text-sm font-semibold text-white">{formatDate(usage.resetAt)}</dd>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <dt className="text-xs uppercase tracking-wide text-scanonix-muted">Plan</dt>
          <dd className="mt-1 text-sm font-semibold capitalize text-white">{usage.plan}</dd>
        </div>
      </div>
    </dl>
  );
}

export function AccountBillingSection() {
  const { profile } = useAuth();
  const effectivePlan = getEffectivePlan(profile);
  const [usage, setUsage] = useState<UsageSummaryResponse | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadUsage() {
      setLoading(true);
      setUsageError(null);
      const summary = await fetchUsageSummary();
      if (cancelled) return;
      if (!summary) {
        setUsageError("Could not load usage summary.");
      } else {
        setUsage(summary);
      }
      setLoading(false);
    }

    void loadUsage();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <AccountCard
        title="Usage & credits"
        description="Track tool usage and remaining credits for your current billing period."
      >
        {loading ? <UsageSkeleton /> : null}
        {!loading && usageError ? (
          <p className="text-sm text-red-400" role="alert">
            {usageError}
          </p>
        ) : null}
        {!loading && usage ? <UsageOverview usage={usage} /> : null}
      </AccountCard>

      {effectivePlan === "free" ? (
        <AccountCard
          title="Upgrade your plan"
          description="Unlock higher limits, priority processing, and premium AI features."
        >
          <ActionButton href="/pricing">View plans & upgrade</ActionButton>
        </AccountCard>
      ) : null}

      <BillingPanel />
    </div>
  );
}
