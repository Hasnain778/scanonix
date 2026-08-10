"use client";

import { useEffect, useState } from "react";
import { AdminBarChart } from "@/components/admin/AdminCharts";
import type { AdminAnalyticsData } from "@/lib/admin/types";

export function AdminAnalyticsPanel() {
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/analytics", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load");
        setData(json as AdminAnalyticsData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!data) return <p className="text-sm text-scanonix-muted">Loading analytics…</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <AdminBarChart
        title="Daily scans (30d)"
        data={data.dailyScans.slice(-14).map((d) => ({ label: d.date.slice(5), value: d.count }))}
      />
      <AdminBarChart
        title="New users (30d)"
        data={data.newUsers.slice(-14).map((d) => ({ label: d.date.slice(5), value: d.count }))}
      />
      <AdminBarChart
        title="Risk distribution"
        data={data.riskDistribution.map((d) => ({ label: d.bucket, value: d.count }))}
      />
      <AdminBarChart
        title="Scan volume by type"
        data={[
          { label: "Website", value: data.scanVolume.website },
          { label: "File", value: data.scanVolume.file },
        ]}
      />
      <AdminBarChart
        title="Threat categories"
        data={data.threatCategories.map((d) => ({ label: d.category, value: d.count }))}
      />
      <AdminBarChart
        title="Est. daily revenue"
        data={data.revenueByDay.slice(-14).map((d) => ({ label: d.date.slice(5), value: d.amount }))}
        valueSuffix=""
      />
    </div>
  );
}
