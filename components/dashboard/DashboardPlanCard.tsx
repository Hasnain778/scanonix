"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ActionButton } from "@/components/ui/ActionButton";
import { UsageCardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { buttonTap } from "@/components/dashboard/dashboard-motion";
import {
  formatDashboardDate,
  getPlanBadgeClass,
  getPlanBenefits,
} from "@/components/dashboard/dashboard-utils";
import type { UsageSummaryResponse } from "@/lib/plan/client";
import type { AuthUser } from "@/types/auth";

interface DashboardPlanCardProps {
  user: AuthUser;
  plan: string;
  usage: UsageSummaryResponse | null;
  loading?: boolean;
}

export function DashboardPlanCard({
  user,
  plan,
  usage,
  loading = false,
}: DashboardPlanCardProps) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const isPaid = plan !== "free";
  const benefits = getPlanBenefits(plan);

  async function handleManageSubscription() {
    setPortalLoading(true);
    setPortalError(null);

    try {
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        setPortalError(data.error ?? "Could not open billing portal.");
        setPortalLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setPortalError("Could not open billing portal.");
      setPortalLoading(false);
    }
  }

  if (loading) {
    return <UsageCardSkeleton />;
  }

  const usedPercent =
    usage && usage.limit > 0
      ? Math.min((usage.usageCount / usage.limit) * 100, 100)
      : 0;

  return (
    <section
      aria-labelledby="plan-card-heading"
      className="surface-card p-5 sm:p-6"
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-eyebrow text-xs uppercase tracking-[0.18em]">Your plan</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 id="plan-card-heading" className="text-page-title text-xl capitalize sm:text-2xl">
              {plan === "free" ? "Free" : plan === "pro" ? "Pro" : plan}
            </h2>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getPlanBadgeClass(plan)}`}
            >
              {isPaid ? "Active subscription" : "Free tier"}
            </span>
          </div>

          <ul className="mt-6 space-y-2.5">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-2.5 text-sm text-scanonix-muted">
                <span className="text-scanonix-orange" aria-hidden="true">✓</span>
                {benefit}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs text-scanonix-muted">{user.email}</p>
        </div>

        <div className="w-full shrink-0 lg:max-w-sm">
          <div className="rounded-xl border border-border bg-surface-muted p-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <p className="text-sm font-medium text-foreground">Usage</p>
              {usage ? (
                <p className="text-sm text-scanonix-muted">
                  {usage.usageCount} / {usage.limit}
                </p>
              ) : (
                <p className="text-sm text-scanonix-muted">—</p>
              )}
            </div>

            <div className="relative h-2.5 overflow-hidden rounded-full bg-surface">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usedPercent}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-scanonix-orange to-scanonix-orange-light"
              />
            </div>

            {usage ? (
              <p className="mt-3 text-xs text-scanonix-muted">
                Resets {formatDashboardDate(usage.resetAt)}
              </p>
            ) : null}
          </div>

          {portalError ? (
            <p className="mt-3 text-sm text-red-400">{portalError}</p>
          ) : null}

          <div className="mt-5 flex flex-col gap-3">
            {isPaid ? (
              <motion.div {...buttonTap}>
                <ActionButton
                  variant="outline"
                  className="w-full"
                  loading={portalLoading}
                  onClick={() => void handleManageSubscription()}
                >
                  Manage Subscription
                </ActionButton>
              </motion.div>
            ) : (
              <motion.div {...buttonTap}>
                <ActionButton href="/pricing" className="w-full">
                  Upgrade plan
                </ActionButton>
              </motion.div>
            )}
            <Link
              href="/account/billing"
              className="text-center text-sm font-medium text-scanonix-orange transition-colors hover:text-scanonix-orange-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50 rounded-lg py-1"
            >
              View billing details
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
