"use client";

import type { AdminChartPoint } from "@/lib/admin/types";

interface AdminBarChartProps {
  title: string;
  data: AdminChartPoint[];
  valueSuffix?: string;
}

export function AdminBarChart({ title, data, valueSuffix = "" }: AdminBarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="glass-card rounded-2xl p-5 shadow-premium">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-scanonix-muted">No data available.</p>
      ) : (
        <div className="space-y-3">
          {data.map((point) => (
            <div key={point.label}>
              <div className="mb-1 flex justify-between text-xs text-scanonix-muted">
                <span className="truncate pr-2">{point.label}</span>
                <span className="shrink-0 font-medium text-foreground">
                  {point.value}
                  {valueSuffix}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-scanonix-orange transition-all"
                  style={{ width: `${Math.max((point.value / max) * 100, 4)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface AdminStatCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

export function AdminStatCard({ label, value, hint }: AdminStatCardProps) {
  return (
    <div className="glass-card rounded-2xl p-5 shadow-premium">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-scanonix-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-scanonix-muted">{hint}</p> : null}
    </div>
  );
}

export function AdminStatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
  );
}
