"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AdminScanRow } from "@/lib/admin/types";

const adminControlClass =
  "rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm text-foreground outline-none focus:border-scanonix-orange/50";

export function AdminScansPanel() {
  const [scans, setScans] = useState<AdminScanRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [targetType, setTargetType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadScans() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status !== "all") params.set("status", status);
      if (targetType !== "all") params.set("targetType", targetType);

      try {
        const res = await fetch(`/api/admin/scans?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to load scans");
        setScans(data.scans ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load scans");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadScans();
    return () => {
      cancelled = true;
    };
  }, [refreshToken, search, status, targetType]);

  async function deleteScan(id: string) {
    if (!window.confirm("Delete this scan report permanently?")) return;
    const res = await fetch(`/api/admin/scans/${id}`, { method: "DELETE" });
    if (res.ok) setRefreshToken((token) => token + 1);
  }

  return (
    <div className="space-y-4">
      <div className="glass-card flex flex-wrap gap-3 rounded-2xl p-4 shadow-premium">
        <input
          type="search"
          placeholder="Search target, email, ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`min-w-[200px] flex-1 px-4 ${adminControlClass}`}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={adminControlClass}>
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="processing">Processing</option>
        </select>
        <select value={targetType} onChange={(e) => setTargetType(e.target.value)} className={adminControlClass}>
          <option value="all">All types</option>
          <option value="website">Website</option>
          <option value="file">File</option>
        </select>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="text-sm text-scanonix-muted">Loading scans…</p> : null}

      <div className="glass-card overflow-hidden rounded-2xl shadow-premium">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-scanonix-muted">
              <tr>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id} className="border-b border-border transition-colors hover:bg-surface-muted/60">
                  <td className="max-w-xs truncate px-4 py-3 font-medium text-foreground">{scan.target}</td>
                  <td className="px-4 py-3 text-xs text-scanonix-muted">{scan.userEmail ?? scan.userId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-foreground-secondary">{scan.riskScore}</td>
                  <td className="px-4 py-3 capitalize text-foreground-secondary">{scan.status}</td>
                  <td className="px-4 py-3 text-xs text-scanonix-muted">
                    {new Date(scan.createdAt).toLocaleString("en-GB")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/scan-results/${scan.id}`}
                        className="text-xs font-medium text-scanonix-orange hover:underline"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => void deleteScan(scan.id)}
                        className="text-xs font-medium text-red-300 hover:underline"
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
      </div>
    </div>
  );
}
