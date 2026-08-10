"use client";

import { useEffect, useState } from "react";
import { AdminBarChart, AdminStatCard, AdminStatGrid } from "@/components/admin/AdminCharts";
import type { AdminDashboardStats } from "@/lib/admin/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminDashboardPanel() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/dashboard", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load dashboard");
        setStats(data as AdminDashboardStats);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  if (error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }

  if (!stats) {
    return <p className="text-sm text-scanonix-muted">Loading dashboard…</p>;
  }

  return (
    <div className="space-y-6">
      <AdminStatGrid>
        <AdminStatCard label="Total users" value={stats.totalUsers} />
        <AdminStatCard label="Active users (7d)" value={stats.activeUsers7d} />
        <AdminStatCard label="Active users (30d)" value={stats.activeUsers30d} />
        <AdminStatCard label="Total scans" value={stats.totalScans} />
        <AdminStatCard label="Website scans" value={stats.websiteScans} />
        <AdminStatCard label="File scans" value={stats.fileScans} />
        <AdminStatCard label="Average risk score" value={`${stats.averageRiskScore}/100`} />
        <AdminStatCard label="Premium subscribers" value={stats.premiumSubscribers} />
        <AdminStatCard label="Est. MRR" value={`£${stats.monthlyRevenueGbp.toFixed(2)}`} />
        <AdminStatCard label="Scan success rate" value={`${stats.scanSuccessRate}%`} />
        <AdminStatCard label="API usage" value={stats.apiUsageTotal} />
        <AdminStatCard label="Report storage (sample)" value={formatBytes(stats.storageUsageBytes)} />
      </AdminStatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminBarChart
          title="Top scan countries"
          data={stats.topCountries.map((c) => ({ label: c.country, value: c.count }))}
        />
        <AdminBarChart
          title="Most common findings"
          data={stats.topFindings.map((f) => ({ label: f.title, value: f.count }))}
        />
      </div>
    </div>
  );
}
