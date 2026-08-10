"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ActionButton } from "@/components/ui/ActionButton";
import { buttonTap } from "@/components/dashboard/dashboard-motion";
import {
  formatDashboardDate,
  getBillingStatusLabel,
  getPlanBadgeClass,
} from "@/components/dashboard/dashboard-utils";
import type { AuthUser } from "@/types/auth";

interface DashboardSubscriptionCardProps {
  user: AuthUser;
  plan: string;
  subscriptionStatus: string | null;
  renewalDate: string | null;
  cancelAtPeriodEnd: boolean;
}

export function DashboardSubscriptionCard({
  user,
  plan,
  subscriptionStatus,
  renewalDate,
  cancelAtPeriodEnd,
}: DashboardSubscriptionCardProps) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const isPaid = plan !== "free";

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

  return (
    <section className="glass-card rounded-2xl p-6 shadow-premium">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">Subscription</h2>
        <p className="mt-1 text-sm text-scanonix-muted">
          Plan details for {user.email}
        </p>
      </div>

      <dl className="space-y-4">
        <SubscriptionRow
          label="Current plan"
          value={
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold capitalize ${getPlanBadgeClass(plan)}`}
            >
              {plan}
            </span>
          }
        />
        <SubscriptionRow
          label="Billing status"
          value={getBillingStatusLabel(plan, subscriptionStatus)}
        />
        <SubscriptionRow
          label="Renewal date"
          value={
            isPaid
              ? formatDashboardDate(renewalDate)
              : "No active subscription"
          }
        />
      </dl>

      {cancelAtPeriodEnd && isPaid ? (
        <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Your subscription will cancel at the end of the current billing period.
        </p>
      ) : null}

      {portalError ? (
        <p className="mt-4 text-sm text-red-400">{portalError}</p>
      ) : null}

      <div className="mt-6">
        {isPaid ? (
          <motion.div {...buttonTap}>
            <ActionButton
              variant="outline"
              className="w-full"
              loading={portalLoading}
              onClick={() => void handleManageSubscription()}
            >
              Manage subscription
            </ActionButton>
          </motion.div>
        ) : (
          <motion.div {...buttonTap}>
            <ActionButton href="/pricing" className="w-full">
              Upgrade plan
            </ActionButton>
          </motion.div>
        )}
      </div>

      <div className="mt-4 text-center">
        <Link
          href="/account/billing"
          className="text-sm font-medium text-scanonix-orange hover:text-scanonix-orange-light"
        >
          Open billing settings
        </Link>
      </div>
    </section>
  );
}

function SubscriptionRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/6 pb-4 last:border-b-0 last:pb-0">
      <dt className="text-sm text-scanonix-muted">{label}</dt>
      <dd className="text-sm font-semibold text-white">{value}</dd>
    </div>
  );
}
