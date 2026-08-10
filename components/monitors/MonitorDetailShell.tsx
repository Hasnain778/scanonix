"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { frequencyLabel } from "@/lib/monitors/scheduler";
import type { MonitorEventRecord, SecurityMonitorRecord } from "@/lib/monitors/types";

export function MonitorDetailShell({ monitorId }: { monitorId: string }) {
  const [monitor, setMonitor] = useState<SecurityMonitorRecord | null>(null);
  const [events, setEvents] = useState<MonitorEventRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [monitorRes, eventsRes] = await Promise.all([
          fetch(`/api/monitors/${monitorId}`, { cache: "no-store" }),
          fetch(`/api/monitors/${monitorId}/timeline`, { cache: "no-store" }),
        ]);
        const monitorData = await monitorRes.json();
        const eventsData = await eventsRes.json();
        if (cancelled) return;
        if (!monitorRes.ok) throw new Error(monitorData.error ?? "Failed to load monitor");
        setMonitor(monitorData.monitor);
        setEvents(eventsData.events ?? []);
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
  if (!monitor) return <p className="text-sm text-scanonix-muted">Loading monitor…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/monitors" className="text-sm text-scanonix-orange hover:underline">← All monitors</Link>
          <h1 className="mt-2 text-2xl font-bold text-white">{monitor.label ?? monitor.targetUrl}</h1>
          <p className="mt-1 text-sm text-scanonix-muted">{monitor.targetUrl}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href={`/monitors/${monitor.id}/history`} className="rounded-xl border border-white/10 px-3 py-2 text-scanonix-muted hover:text-white">
            Run history
          </Link>
          {monitor.lastScanId ? (
            <Link href={`/scan-results/${monitor.lastScanId}`} className="rounded-xl bg-scanonix-orange/15 px-3 py-2 text-scanonix-orange hover:underline">
              Latest report
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Metric label="Frequency" value={frequencyLabel(monitor.frequency)} />
        <Metric label="Status" value={monitor.status} />
        <Metric label="Last risk score" value={monitor.lastRiskScore?.toString() ?? "—"} />
        <Metric label="Next scan" value={monitor.nextScanAt ? new Date(monitor.nextScanAt).toLocaleString("en-GB") : "—"} />
      </div>

      <section className="glass-card rounded-2xl p-5 shadow-premium">
        <h2 className="text-lg font-semibold text-white">Security timeline</h2>
        <p className="mt-1 text-sm text-scanonix-muted">Changes detected across scheduled scans.</p>
        <ul className="mt-4 space-y-3">
          {events.map((event) => (
            <li key={event.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{event.title}</p>
                  <p className="mt-1 text-sm text-scanonix-muted">{event.message}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs uppercase ${severityClass(event.severity)}`}>
                  {event.severity}
                </span>
              </div>
              <p className="mt-2 text-xs text-scanonix-muted">{new Date(event.createdAt).toLocaleString("en-GB")}</p>
            </li>
          ))}
        </ul>
        {events.length === 0 ? <p className="mt-4 text-sm text-scanonix-muted">No timeline events yet.</p> : null}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-2xl p-4 shadow-premium">
      <p className="text-xs uppercase tracking-wide text-scanonix-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function severityClass(severity: string) {
  if (severity === "critical") return "bg-red-500/15 text-red-300";
  if (severity === "warning") return "bg-amber-500/15 text-amber-300";
  return "bg-emerald-500/15 text-emerald-300";
}
