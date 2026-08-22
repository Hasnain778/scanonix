"use client";

import { useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { PricingPagePlans } from "@/components/pricing/PricingPagePlans";
import { useAuth } from "@/components/auth/AuthProvider";
import { ANALYTICS_SURFACES } from "@/lib/analytics/surfaces";
import { getEffectivePlan } from "@/lib/auth/entitlements";

interface PricingPlansProps {
  activePlanKey?: string | null;
}

export function PricingPlans(props: PricingPlansProps) {
  return <PricingPagePlans {...props} />;
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function BillingPanel() {
  const { profile, refresh } = useAuth();
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const effectivePlan = getEffectivePlan(profile);
  const renewalDate = formatDate(profile?.subscription_current_period_end);

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
      setPortalError("Billing portal is unavailable. Please try again.");
      setPortalLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="surface-card p-6">
        <h2 className="text-section-title">Billing overview</h2>
        <dl className="mt-5 space-y-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-scanonix-muted">Current plan</dt>
            <dd className="font-semibold capitalize text-white">{effectivePlan}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-scanonix-muted">Subscription status</dt>
            <dd className="font-semibold capitalize text-white">
              {profile?.subscription_status ?? "none"}
            </dd>
          </div>
          {renewalDate && (
            <div className="flex items-start justify-between gap-4">
              <dt className="text-scanonix-muted">
                {profile?.cancel_at_period_end ? "Access until" : "Renews on"}
              </dt>
              <dd className="font-semibold text-white">{renewalDate}</dd>
            </div>
          )}
        </dl>

        {profile?.cancel_at_period_end && (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Your subscription is set to cancel at the end of the current billing
            period. You keep access until then.
          </p>
        )}

        {profile?.stripe_customer_id ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <ActionButton
              loading={portalLoading}
              disabled={portalLoading}
              onClick={handleManageSubscription}
            >
              Manage subscription
            </ActionButton>
            <ActionButton variant="outline" onClick={() => void refresh()}>
              Refresh status
            </ActionButton>
          </div>
        ) : (
          <ActionButton href="/pricing" className="mt-6">
            View plans
          </ActionButton>
        )}

        {portalError && (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {portalError}
          </p>
        )}
      </section>

      <section className="surface-card p-6">
        <h2 className="text-section-title">Change plan</h2>
        <p className="text-body mt-2">
          Upgrade, downgrade, or switch billing interval through Stripe Checkout
          or the Customer Portal.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <CheckoutButton
            plan="pro"
            interval="monthly"
            label="Upgrade to Pro Monthly"
            sourceSurface={ANALYTICS_SURFACES.ACCOUNT_BILLING}
          />
          <CheckoutButton
            plan="pro"
            interval="yearly"
            label="Upgrade to Pro Yearly"
            variant="outline"
            sourceSurface={ANALYTICS_SURFACES.ACCOUNT_BILLING}
          />
          <CheckoutButton
            plan="business"
            interval="monthly"
            label="Upgrade to Business Monthly"
            variant="outline"
            sourceSurface={ANALYTICS_SURFACES.ACCOUNT_BILLING}
          />
          <CheckoutButton
            plan="business"
            interval="yearly"
            label="Upgrade to Business Yearly"
            variant="outline"
            sourceSurface={ANALYTICS_SURFACES.ACCOUNT_BILLING}
          />
        </div>
      </section>
    </div>
  );
}
