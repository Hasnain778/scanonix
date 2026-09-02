"use client";

import { useEffect, useState } from "react";
import type { AdminMonitoringStats } from "@/lib/admin/types";

export function AdminMonitoringPanel() {
  const [stats, setStats] = useState<AdminMonitoringStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/monitoring", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setStats(data as AdminMonitoringStats);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!stats) return <p className="text-sm text-scanonix-muted">Loading monitoring stats…</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Monitored websites" value={stats.totalMonitoredWebsites} />
        <Stat label="Active monitors" value={stats.activeMonitors} />
        <Stat label="Paused monitors" value={stats.pausedMonitors} />
        <Stat label="Jobs today" value={stats.dailyJobsToday} />
        <Stat label="Pending jobs" value={stats.pendingJobs} />
        <Stat label="Failed jobs (24h)" value={stats.failedJobs24h} />
        <Stat label="Notification queue" value={stats.pendingNotifications} />
      </div>

      <div className="glass-card overflow-hidden rounded-2xl shadow-premium">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Recent monitoring failures</h3>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-scanonix-muted">
            <tr>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Error</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentFailures.map((failure) => (
              <tr key={failure.id} className="border-b border-border transition-colors hover:bg-surface-muted/60">
                <td className="px-4 py-3 font-medium text-foreground">{failure.targetUrl}</td>
                <td className="px-4 py-3 text-scanonix-muted">{failure.errorMessage ?? "Unknown"}</td>
                <td className="px-4 py-3 text-xs text-scanonix-muted">{new Date(failure.createdAt).toLocaleString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {stats.recentFailures.length === 0 ? (
          <p className="p-4 text-sm text-scanonix-muted">No recent failures.</p>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card rounded-2xl p-5 shadow-premium">
      <p className="text-xs uppercase tracking-wide text-scanonix-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
