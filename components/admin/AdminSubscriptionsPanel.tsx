"use client";

import { useEffect, useState } from "react";
import { AdminStatCard, AdminStatGrid } from "@/components/admin/AdminCharts";
import type { AdminSubscriptionStats } from "@/lib/admin/types";

export function AdminSubscriptionsPanel() {
  const [stats, setStats] = useState<AdminSubscriptionStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/subscriptions", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setStats(data as AdminSubscriptionStats);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!stats) return <p className="text-sm text-scanonix-muted">Loading subscriptions…</p>;

  return (
    <div className="space-y-6">
      <AdminStatGrid>
        <AdminStatCard label="Free users" value={stats.free} />
        <AdminStatCard label="Pro users" value={stats.pro} />
        <AdminStatCard label="Business users" value={stats.business} />
        <AdminStatCard label="Active subscriptions" value={stats.activeSubscriptions} />
        <AdminStatCard label="Canceled / ending" value={stats.canceledSubscriptions} />
        <AdminStatCard label="MRR (est.)" value={`£${stats.mrrGbp.toFixed(2)}`} />
      </AdminStatGrid>

      <div className="glass-card overflow-hidden rounded-2xl shadow-premium">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-scanonix-muted">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">MRR</th>
                <th className="px-4 py-3">Cancel at period end</th>
              </tr>
            </thead>
            <tbody>
              {stats.subscribers.map((sub) => (
                <tr key={sub.id} className="border-b border-border transition-colors hover:bg-surface-muted/60">
                  <td className="px-4 py-3 font-medium text-foreground">{sub.email}</td>
                  <td className="px-4 py-3 capitalize text-foreground-secondary">{sub.plan}</td>
                  <td className="px-4 py-3 text-foreground-secondary">{sub.status ?? "—"}</td>
                  <td className="px-4 py-3 text-foreground-secondary">£{sub.mrrGbp.toFixed(2)}</td>
                  <td className="px-4 py-3 text-foreground-secondary">{sub.cancelAtPeriodEnd ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
