"use client";

import { ActionButton } from "@/components/ui/ActionButton";
import { SecurityStatusSkeleton } from "@/components/dashboard/DashboardSkeleton";
import {
  getHeroDescription,
  getHeroHeadline,
} from "@/components/dashboard/dashboard-utils";
import type { SecurityStatus } from "@/components/dashboard/dashboard-types";

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016m-7.036 1.036a3 3 0 113 3 3 3 0 01-3-3z"
      />
    </svg>
  );
}

const SHIELD_ACCENT: Record<SecurityStatus, string> = {
  protected: "dashboard-hero-shield--protected from-emerald-500/15 to-emerald-500/5 text-emerald-300",
  needs_attention: "dashboard-hero-shield--warning from-amber-500/15 to-amber-500/5 text-amber-200",
  high_risk: "dashboard-hero-shield--danger from-red-500/15 to-red-500/5 text-red-300",
  no_scans: "from-scanonix-orange/15 to-scanonix-orange/5 text-scanonix-orange",
};

const CARD_BORDER: Record<SecurityStatus, string> = {
  protected: "border-emerald-500/15",
  needs_attention: "border-amber-500/15",
  high_risk: "border-red-500/20",
  no_scans: "border-white/10",
};

interface DashboardSecurityStatusCardProps {
  status: SecurityStatus;
  loading?: boolean;
}

export function DashboardSecurityStatusCard({
  status,
  loading = false,
}: DashboardSecurityStatusCardProps) {
  if (loading) {
    return <SecurityStatusSkeleton />;
  }

  const headline = getHeroHeadline(status);
  const description = getHeroDescription(status);

  return (
    <section
      aria-labelledby="security-status-heading"
      className={`rounded-2xl border bg-[#0c0c0c]/60 backdrop-blur-sm ${CARD_BORDER[status]}`}
    >
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className={`dashboard-shield-pulse flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${SHIELD_ACCENT[status]}`}
          >
            <ShieldIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 id="security-status-heading" className="text-lg font-semibold text-white sm:text-xl">
              {headline}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-scanonix-muted sm:text-base">
              {description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <ActionButton href="/tools/security-scan" size="md" className="w-full sm:min-w-[140px]">
            Start new scan
          </ActionButton>
          <ActionButton
            href="/scan-history"
            variant="outline"
            size="md"
            className="w-full sm:min-w-[130px]"
          >
            View reports
          </ActionButton>
        </div>
      </div>
    </section>
  );
}
