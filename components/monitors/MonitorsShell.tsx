"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { ProBadge } from "@/components/tools/background-remover/ProBadge";
import { ProSecurityGate } from "@/components/tools/security/ProSecurityGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { useProAccess } from "@/hooks/useProAccess";
import { frequencyLabel } from "@/lib/monitors/scheduler";
import type { MonitorSummary, SecurityMonitorRecord } from "@/lib/monitors/types";

export function MonitorsShell() {
  const [monitors, setMonitors] = useState<SecurityMonitorRecord[]>([]);
  const [summary, setSummary] = useState<MonitorSummary | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loading: proLoading, isAuthenticated, isPro } = useProAccess();
  const showProGate = !proLoading && !isPro;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [monitorsRes, summaryRes] = await Promise.all([
        fetch("/api/monitors", { cache: "no-store" }),
        fetch("/api/monitors/summary", { cache: "no-store" }),
      ]);
      const monitorsData = await monitorsRes.json();
      const summaryData = await summaryRes.json();
      if (!monitorsRes.ok) throw new Error(monitorsData.error ?? "Failed to load monitors");
      setMonitors(monitorsData.monitors ?? []);
      setSummary(summaryRes.ok ? summaryData : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load monitors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await load();
      if (cancelled) return;
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function createMonitor(event: React.FormEvent) {
    event.preventDefault();
    if (!targetUrl.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: targetUrl.trim(), frequency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create monitor");
      setTargetUrl("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create monitor");
    } finally {
      setCreating(false);
    }
  }

  async function updateStatus(id: string, status: "active" | "paused") {
    await fetch(`/api/monitors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function removeMonitor(id: string) {
    if (!window.confirm("Delete this monitor permanently?")) return;
    await fetch(`/api/monitors/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Monitoring"
        title="Security monitors"
        description="Scan websites on a schedule and get alerted when security posture changes."
      />

      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-scanonix-orange" aria-hidden="true" />
        <span className="text-sm font-medium text-white">Website Monitoring</span>
        <ProBadge />
      </div>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total" value={summary.totalMonitors} />
          <Stat label="Active" value={summary.activeMonitors} />
          <Stat label="Paused" value={summary.pausedMonitors} />
          <Stat label="Alerts (7d)" value={summary.alertsThisWeek} />
        </div>
      ) : null}

      <form
        onSubmit={(e) => void createMonitor(e)}
        className="surface-card flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="min-w-[220px] flex-1">
          <label htmlFor="monitor-url" className="mb-2 block text-sm font-medium text-white">
            Website URL
          </label>
          <input
            id="monitor-url"
            type="url"
            placeholder="https://example.com"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            className="input-field"
          />
        </div>
        <div className="w-full sm:w-auto sm:min-w-[140px]">
          <label htmlFor="monitor-frequency" className="mb-2 block text-sm font-medium text-white">
            Frequency
          </label>
          <select
            id="monitor-frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as typeof frequency)}
            className="select-field"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <ActionButton type="submit" loading={creating} disabled={showProGate} className="w-full sm:w-auto">
          {showProGate ? "Upgrade to Pro to monitor" : creating ? "Adding…" : "Monitor website"}
        </ActionButton>
      </form>

      {showProGate ? (
        <ProSecurityGate
          title="Unlock website monitoring"
          description="Add website URLs and schedule scans. Upgrade to Pro to create monitors and receive alerts."
          isAuthenticated={isAuthenticated}
        />
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="text-sm text-scanonix-muted">Loading monitors…</p> : null}

      <div className="surface-card overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-black/20 text-xs text-scanonix-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Website</th>
                <th className="px-5 py-3 font-medium">Frequency</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Last risk</th>
                <th className="px-5 py-3 font-medium">Next scan</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {monitors.map((monitor) => (
                <tr key={monitor.id} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-4">
                    <Link href={`/monitors/${monitor.id}`} className="font-medium text-white hover:text-scanonix-orange">
                      {monitor.label ?? monitor.targetUrl}
                    </Link>
                    {monitor.label ? <p className="mt-0.5 text-xs text-scanonix-muted">{monitor.targetUrl}</p> : null}
                  </td>
                  <td className="px-5 py-4 text-scanonix-muted">{frequencyLabel(monitor.frequency)}</td>
                  <td className="px-5 py-4 capitalize text-scanonix-muted">{monitor.status}</td>
                  <td className="px-5 py-4">{monitor.lastRiskScore ?? "—"}</td>
                  <td className="px-5 py-4 text-xs text-scanonix-muted">
                    {monitor.nextScanAt ? new Date(monitor.nextScanAt).toLocaleString("en-GB") : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-3 text-xs">
                      <Link href={`/monitors/${monitor.id}/history`} className="text-scanonix-orange hover:underline">
                        History
                      </Link>
                      <button
                        type="button"
                        onClick={() => void updateStatus(monitor.id, monitor.status === "active" ? "paused" : "active")}
                        className="text-scanonix-muted hover:text-white"
                      >
                        {monitor.status === "active" ? "Pause" : "Resume"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeMonitor(monitor.id)}
                        className="text-red-300 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && monitors.length === 0 ? (
          <p className="p-6 text-sm text-scanonix-muted">
            No monitors yet. Add a website above to start continuous monitoring.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card rounded-2xl p-5">
      <p className="text-sm text-scanonix-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
