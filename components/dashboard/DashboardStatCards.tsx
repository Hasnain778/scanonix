"use client";

import { AnimatedNumber } from "@/components/dashboard/AnimatedNumber";
import { StatCardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import type { DashboardStats } from "@/components/dashboard/dashboard-types";
import { getPlanBadgeClass } from "@/components/dashboard/dashboard-utils";

const STAT_ITEMS: {
  key: keyof DashboardStats;
  label: string;
  isPlan?: boolean;
}[] = [
  { key: "totalScans", label: "Total scans" },
  { key: "protectedAssets", label: "Protected assets" },
  { key: "threatsFound", label: "Threats found" },
  { key: "currentPlan", label: "Current plan", isPlan: true },
];

interface DashboardStatCardsProps {
  stats: DashboardStats;
  loading?: boolean;
}

export function DashboardStatCards({ stats, loading = false }: DashboardStatCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_ITEMS.map((item) => (
          <StatCardSkeleton key={item.key} />
        ))}
      </div>
    );
  }

  return (
    <section aria-label="Dashboard statistics">
      <p className="mb-3 text-sm text-scanonix-muted">Overview</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_ITEMS.map((item) => {
          const value = stats[item.key];
          return (
            <article
              key={item.key}
              className="rounded-xl border border-white/6 bg-[#0c0c0c]/30 px-4 py-4"
            >
              <p className="text-sm text-scanonix-muted">{item.label}</p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight text-white">
                {item.isPlan ? (
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-sm font-medium capitalize ${getPlanBadgeClass(String(value))}`}
                  >
                    {value}
                  </span>
                ) : typeof value === "number" ? (
                  <AnimatedNumber value={value} />
                ) : (
                  value
                )}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
