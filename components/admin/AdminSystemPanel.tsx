"use client";

import { useEffect, useState } from "react";
import type { AdminSystemStatus } from "@/lib/admin/types";

export function AdminSystemPanel() {
  const [status, setStatus] = useState<AdminSystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/system", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setStatus(data as AdminSystemStatus);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!status) return <p className="text-sm text-scanonix-muted">Loading system status…</p>;

  return (
    <div className="space-y-6">
      <Section title="Environment">
        <ul className="space-y-2">
          {status.environment.map((item) => (
            <StatusRow key={item.name} label={item.name} ok={item.ok} detail={item.detail} />
          ))}
        </ul>
      </Section>

      <Section title="Infrastructure">
        <StatusRow label="Database" ok={status.database.ok} detail={status.database.detail} />
        <StatusRow label="Queue" ok={status.queue.ok} detail={status.queue.detail} />
        <StatusRow label="Storage" ok={status.storage.ok} detail={status.storage.detail} />
      </Section>

      <Section title="AI provider">
        <StatusRow label="OpenAI" ok={status.aiProvider.ok} detail={status.aiProvider.detail} />
      </Section>

      <Section title="API providers">
        <ul className="space-y-2">
          {status.apiProviders.map((provider) => (
            <StatusRow
              key={provider.name}
              label={provider.name}
              ok={provider.configured}
              detail={provider.configured ? "Configured" : "Not configured"}
            />
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-5 shadow-premium">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <li className="flex items-start justify-between gap-4 border-b border-border py-2 last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-scanonix-muted">{detail}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
          ok ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
        }`}
      >
        {ok ? "OK" : "Check"}
      </span>
    </li>
  );
}
