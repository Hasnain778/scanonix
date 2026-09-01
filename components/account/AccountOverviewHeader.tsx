import Link from "next/link";
import { getEffectivePlan } from "@/lib/auth/plan";
import { getPlanBadgeClass } from "@/components/dashboard/dashboard-utils";
import type { AuthUser } from "@/types/auth";

interface AccountOverviewHeaderProps {
  user: AuthUser;
}

function formatPlanLabel(plan: string): string {
  if (plan === "free") return "Free";
  if (plan === "pro") return "Pro";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function getInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? email.slice(0, 2)).toUpperCase();
}

function AccountAvatar({ user }: { user: AuthUser }) {
  const displayName = user.profile?.full_name?.trim() || user.email;
  const initials = getInitials(displayName, user.email);
  const avatarUrl = user.profile?.avatar_url;

  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-scanonix-orange/15 ring-2 ring-border">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-lg font-bold text-scanonix-orange">{initials}</span>
      )}
    </span>
  );
}

export function AccountOverviewHeader({ user }: AccountOverviewHeaderProps) {
  const plan = getEffectivePlan(user.profile);
  const displayName = user.profile?.full_name?.trim() || user.email.split("@")[0];

  return (
    <section className="surface-card account-surface-card mb-8 p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <AccountAvatar user={user} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">{displayName}</h1>
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getPlanBadgeClass(plan)}`}
              >
                {formatPlanLabel(plan)}
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-body-bright">{user.email}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/account/billing"
            className="inline-flex rounded-xl border border-border bg-surface-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-scanonix-orange/40 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
          >
            Billing
          </Link>
          <Link
            href="/account/profile"
            className="btn-ghost inline-flex px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
          >
            Edit profile
          </Link>
        </div>
      </div>
    </section>
  );
}
