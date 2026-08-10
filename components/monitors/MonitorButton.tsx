"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { frequencyLabel } from "@/lib/monitors/scheduler";

interface MonitorButtonProps {
  targetUrl: string;
  isDemo?: boolean;
}

export function MonitorButton({ targetUrl, isDemo = false }: MonitorButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isDemo) return null;

  async function createMonitor() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl, frequency, label: label.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create monitor");

      setOpen(false);
      router.push(`/monitors/${data.monitor.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create monitor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-scanonix-orange/30 bg-scanonix-orange/10 px-4 py-2 text-sm font-semibold text-scanonix-orange transition hover:bg-scanonix-orange/20"
      >
        Monitor website
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1117] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Monitor this website</h3>
            <p className="mt-2 break-all text-sm text-scanonix-muted">{targetUrl}</p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm text-scanonix-muted">
                Label (optional)
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
                />
              </label>
              <label className="block text-sm text-scanonix-muted">
                Frequency
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
                >
                  <option value="daily">{frequencyLabel("daily")}</option>
                  <option value="weekly">{frequencyLabel("weekly")}</option>
                  <option value="monthly">{frequencyLabel("monthly")}</option>
                </select>
              </label>
            </div>

            {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 py-2 text-sm text-scanonix-muted hover:text-white">
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void createMonitor()}
                className="rounded-xl bg-scanonix-orange px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? "Creating…" : "Start monitoring"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
