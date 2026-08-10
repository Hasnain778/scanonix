"use client";

import { SkeletonLine } from "@/components/dashboard/DashboardSkeleton";
import type { DashboardInsight } from "@/components/dashboard/dashboard-types";

const TONE_STYLES: Record<DashboardInsight["tone"], string> = {
  positive: "text-emerald-200",
  neutral: "text-white",
  warning: "text-amber-200",
  danger: "text-red-200",
};

interface DashboardAiInsightsProps {
  insights: DashboardInsight[];
  loading?: boolean;
}

export function DashboardAiInsights({ insights, loading = false }: DashboardAiInsightsProps) {
  if (loading) {
    return (
      <section className="rounded-xl border border-white/6 bg-[#0c0c0c]/30 p-5">
        <SkeletonLine className="h-5 w-24" />
        <div className="mt-4 space-y-2">
          {[0, 1].map((index) => (
            <SkeletonLine key={index} className="h-4 w-full" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="ai-insights-heading"
      className="rounded-xl border border-white/6 bg-[#0c0c0c]/30 p-5"
    >
      <h2 id="ai-insights-heading" className="text-base font-semibold text-white">
        AI insight
      </h2>

      <ul className="mt-3 space-y-2">
        {insights.map((insight) => (
          <li
            key={insight.id}
            className={`text-base leading-relaxed ${TONE_STYLES[insight.tone]}`}
          >
            {insight.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
