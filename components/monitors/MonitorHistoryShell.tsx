"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MonitorRunRecord } from "@/lib/monitors/types";

export function MonitorHistoryShell({ monitorId }: { monitorId: string }) {
  const [runs, setRuns] = useState<MonitorRunRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/monitors/${monitorId}/timeline?view=runs`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to load history");
        setRuns(data.runs ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [monitorId]);

  if (error) return <p className="text-sm text-red-300">{error}</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/monitors/${monitorId}`} className="text-sm text-scanonix-orange hover:underline">← Monitor timeline</Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Scan history</h1>
        <p className="mt-1 text-sm text-scanonix-muted">All scheduled scan runs for this monitor.</p>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl shadow-premium">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-scanonix-muted">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Change</th>
              <th className="px-4 py-3">Report</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b border-white/5">
                <td className="px-4 py-3 text-xs text-scanonix-muted">{new Date(run.createdAt).toLocaleString("en-GB")}</td>
                <td className="px-4 py-3 capitalize">{run.status}</td>
                <td className="px-4 py-3">{run.riskScore ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-scanonix-muted">
                  {run.changes?.newFindings.length ? `+${run.changes.newFindings.length} new` : "—"}
                  {run.changes?.resolvedFindings.length ? ` / -${run.changes.resolvedFindings.length} resolved` : ""}
                </td>
                <td className="px-4 py-3">
                  {run.scanHistoryId ? (
                    <Link href={`/scan-results/${run.scanHistoryId}`} className="text-scanonix-orange hover:underline">View</Link>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {runs.length === 0 ? <p className="p-6 text-sm text-scanonix-muted">No scheduled runs yet.</p> : null}
      </div>
    </div>
  );
}
