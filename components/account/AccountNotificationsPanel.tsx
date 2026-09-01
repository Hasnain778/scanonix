"use client";

import { useEffect, useState } from "react";
import { AuthMessage } from "@/components/auth/AuthShell";
import { AccountCard } from "@/components/account/AccountFormField";
import type { NotificationPreferenceKey, NotificationPreferences } from "@/types/auth";
import { useToast } from "@/hooks/useToast";

const PREFERENCE_ITEMS: {
  key: NotificationPreferenceKey;
  label: string;
  description: string;
}[] = [
  {
    key: "scan_completed",
    label: "Scan completed",
    description: "Notify me when a security scan finishes.",
  },
  {
    key: "high_risk_found",
    label: "High-risk issue found",
    description: "Alert me when a scan reports elevated risk.",
  },
  {
    key: "weekly_summary",
    label: "Weekly summary",
    description: "Receive a weekly activity digest.",
  },
  {
    key: "billing_alerts",
    label: "Billing alerts",
    description: "Get notified about renewals, payment issues, and plan changes.",
  },
  {
    key: "product_updates",
    label: "Product updates",
    description: "Hear about new features and improvements.",
  },
];

export function AccountNotificationsPanel() {
  const { showToast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      setLoading(true);
      try {
        const response = await fetch("/api/account/notifications", { cache: "no-store" });
        const data = (await response.json()) as NotificationPreferences | { error?: string };
        if (cancelled) return;
        if (!response.ok || "error" in data) {
          setMessage({
            type: "error",
            text:
              "error" in data
                ? (data.error ?? "Could not load preferences.")
                : "Could not load preferences.",
          });
        } else {
          setPreferences(data as NotificationPreferences);
        }
      } catch {
        if (!cancelled) {
          setMessage({ type: "error", text: "Could not load notification preferences." });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPreferences();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle(key: NotificationPreferenceKey, value: boolean) {
    if (!preferences) return;

    const previous = preferences;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/account/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const data = (await response.json()) as NotificationPreferences | { error?: string };

      if (!response.ok || "error" in data) {
        setPreferences(previous);
        const errorText =
          "error" in data ? (data.error ?? "Could not save preference.") : "Could not save preference.";
        setMessage({ type: "error", text: errorText });
        showToast(errorText, "error");
      } else {
        setPreferences(data as NotificationPreferences);
        showToast("Notification preference saved.", "success");
      }
    } catch {
      setPreferences(previous);
      setMessage({ type: "error", text: "Could not save preference." });
      showToast("Could not save preference.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AccountCard
      title="Email notifications"
      description="Choose which updates Scanonix should send to your inbox."
    >
      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          {PREFERENCE_ITEMS.map((item) => (
            <div key={item.key} className="h-16 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : null}

      {!loading && preferences ? (
        <ul className="space-y-3">
          {PREFERENCE_ITEMS.map((item) => (
            <li
              key={item.key}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-surface-muted px-4 py-4"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="mt-1 text-xs text-scanonix-muted">{item.description}</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <span className="sr-only">{item.label}</span>
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-border bg-surface-raised text-scanonix-orange focus:ring-scanonix-orange/40"
                  checked={preferences[item.key]}
                  disabled={saving}
                  onChange={(event) => void handleToggle(item.key, event.target.checked)}
                />
              </label>
            </li>
          ))}
        </ul>
      ) : null}

      {message ? (
        <div className="mt-4">
          <AuthMessage type={message.type} message={message.text} />
        </div>
      ) : null}
    </AccountCard>
  );
}
