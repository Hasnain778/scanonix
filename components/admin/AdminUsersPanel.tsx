"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AdminUserRow } from "@/lib/admin/types";

const adminControlClass =
  "rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm text-foreground outline-none focus:border-scanonix-orange/50";

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (plan !== "all") params.set("plan", plan);
      if (status !== "all") params.set("status", status);

      try {
        const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to load users");
        setUsers(data.users ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load users");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [plan, refreshToken, search, status]);

  async function toggleStatus(user: AdminUserRow) {
    const next = user.status === "active" ? "suspended" : "active";
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) setRefreshToken((token) => token + 1);
  }

  return (
    <div className="space-y-4">
      <div className="glass-card flex flex-wrap gap-3 rounded-2xl p-4 shadow-premium">
        <input
          type="search"
          placeholder="Search name, email, ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`min-w-[200px] flex-1 px-4 ${adminControlClass}`}
        />
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className={adminControlClass}>
          <option value="all">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={adminControlClass}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="text-sm text-scanonix-muted">Loading users…</p> : null}

      <div className="glass-card overflow-hidden rounded-2xl shadow-premium">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-scanonix-muted">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Scans</th>
                <th className="px-4 py-3">Last active</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border transition-colors hover:bg-surface-muted/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{user.fullName ?? "—"}</p>
                    <p className="text-xs text-scanonix-muted">{user.email}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-foreground-secondary">{user.plan}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                        user.status === "active"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground-secondary">{user.totalScans}</td>
                  <td className="px-4 py-3 text-xs text-scanonix-muted">
                    {user.lastActive ? new Date(user.lastActive).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/users?userId=${user.id}`}
                        className="text-xs font-medium text-scanonix-orange hover:underline"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => void toggleStatus(user)}
                        className="text-xs font-medium text-scanonix-muted hover:text-foreground"
                      >
                        {user.status === "active" ? "Suspend" : "Reactivate"}
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
