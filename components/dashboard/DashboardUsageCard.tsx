"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { UsageCardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { formatDashboardDate, getPlanBadgeClass } from "@/components/dashboard/dashboard-utils";
import type { UsageSummaryResponse } from "@/lib/plan/client";

interface DashboardUsageCardProps {
  usage: UsageSummaryResponse | null;
  loading?: boolean;
}

export function DashboardUsageCard({ usage, loading = false }: DashboardUsageCardProps) {
  if (loading) {
    return <UsageCardSkeleton />;
  }

  if (!usage) {
    return (
      <section className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white">Usage</h2>
        <p className="mt-3 text-sm text-scanonix-muted">
          Usage summary unavailable. Refresh the page or sign in again.
        </p>
      </section>
    );
  }

  const usedPercent = usage.limit > 0 ? Math.min((usage.usageCount / usage.limit) * 100, 100) : 0;
  const exhausted = usage.remaining <= 0;
  const periodLabel = usage.plan === "free" ? "Daily usage" : "Monthly usage";

  return (
    <section className="glass-card rounded-2xl p-6 shadow-premium">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{periodLabel}</h2>
          <p className="mt-1 text-sm text-scanonix-muted">
            Track your operation credits for this billing period
          </p>
        </div>
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getPlanBadgeClass(usage.plan)}`}
        >
          {usage.plan}
        </span>
      </div>

      <div className="mb-2 flex items-end justify-between gap-3">
        <p className="text-sm text-scanonix-muted">Used</p>
        <p className="text-sm font-medium text-white">
          {usage.usageCount} / {usage.limit}
        </p>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full bg-white/8">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${usedPercent}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={`absolute inset-y-0 left-0 rounded-full ${
            exhausted
              ? "bg-linear-to-r from-red-500 to-red-400"
              : "bg-linear-to-r from-scanonix-orange to-scanonix-orange-light"
          }`}
        />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <UsageMetric label="Used" value={String(usage.usageCount)} />
        <UsageMetric
          label="Remaining"
          value={String(usage.remaining)}
          highlight={exhausted ? "danger" : "success"}
        />
        <UsageMetric label="Reset date" value={formatDashboardDate(usage.resetAt)} compact />
      </div>

      {exhausted ? (
        <p className="mt-5 text-sm text-red-300">
          Limit reached.{" "}
          <Link href="/pricing" className="font-semibold text-scanonix-orange hover:underline">
            Upgrade your plan
          </Link>{" "}
          for more operations.
        </p>
      ) : null}
    </section>
  );
}

function UsageMetric({
  label,
  value,
  highlight,
  compact = false,
}: {
  label: string;
  value: string;
  highlight?: "success" | "danger";
  compact?: boolean;
}) {
  const valueClass =
    highlight === "danger"
      ? "text-red-400"
      : highlight === "success"
        ? "text-emerald-400"
        : "text-white";

  return (
    <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-scanonix-muted">
        {label}
      </p>
      <p className={`mt-1 font-semibold ${compact ? "text-sm" : "text-xl"} ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}
