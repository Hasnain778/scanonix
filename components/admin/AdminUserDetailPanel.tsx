"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface UserDetail {
  profile: {
    id: string;
    full_name: string | null;
    plan: string;
    role: string;
    status: string;
    country: string | null;
    company_name: string | null;
    job_title: string | null;
    created_at: string;
    subscription_status: string | null;
    cancel_at_period_end: boolean | null;
  };
  email: string | null;
  totalScans: number;
  recentScans: {
    id: string;
    target: string;
    target_type: string;
    risk_score: number;
    status: string;
    created_at: string;
  }[];
}

export function AdminUserDetailPanel() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    void fetch(`/api/admin/users/${userId}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load user");
        setDetail(data as UserDetail);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [userId]);

  if (!userId) return null;

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!detail) return <p className="text-sm text-scanonix-muted">Loading user profile…</p>;

  const { profile } = detail;

  return (
    <div className="glass-card space-y-4 rounded-2xl p-5 shadow-premium">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{profile.full_name ?? "Unnamed user"}</h3>
          <p className="text-sm text-scanonix-muted">{detail.email}</p>
        </div>
        <Link href="/admin/users" className="text-xs font-medium text-scanonix-orange hover:underline">
          Back to list
        </Link>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <Detail label="Plan" value={profile.plan} />
        <Detail label="Role" value={profile.role} />
        <Detail label="Status" value={profile.status} />
        <Detail label="Country" value={profile.country ?? "—"} />
        <Detail label="Company" value={profile.company_name ?? "—"} />
        <Detail label="Job title" value={profile.job_title ?? "—"} />
        <Detail label="Total scans" value={String(detail.totalScans)} />
        <Detail label="Created" value={new Date(profile.created_at).toLocaleString("en-GB")} />
        <Detail label="Subscription" value={profile.subscription_status ?? "—"} />
      </dl>

      {detail.recentScans.length > 0 ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">Recent scans</h4>
          <ul className="space-y-2 text-sm">
            {detail.recentScans.map((scan) => (
              <li key={scan.id} className="flex justify-between gap-2 border-b border-border py-2">
                <span className="truncate text-foreground-secondary">{scan.target}</span>
                <Link href={`/scan-results/${scan.id}`} className="shrink-0 text-xs text-scanonix-orange hover:underline">
                  View
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-scanonix-muted">{label}</dt>
      <dd className="mt-0.5 capitalize text-foreground">{value}</dd>
    </div>
  );
}
