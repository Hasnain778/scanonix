"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ActionButton } from "@/components/ui/ActionButton";
import { AuthMessage } from "@/components/auth/AuthShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { ANALYTICS_SOURCE_SURFACE_UNKNOWN } from "@/lib/analytics/surfaces";
import type { BillingIntervalValue } from "@/lib/analytics/events";
import { tryTrackSubscriptionComplete } from "@/lib/analytics/subscription-complete";
import { getEffectivePlan, hasActiveSubscription } from "@/lib/auth/entitlements";
import type { BillingPlan } from "@/types/auth";

interface BillingStatusResponse {
  plan: string;
  storedPlan: string;
  subscriptionStatus: string | null;
  hasActiveSubscription: boolean;
  subscriptionCurrentPeriodEnd?: string | null;
  billing_interval?: BillingIntervalValue | null;
}

interface SyncSessionSuccessResponse extends BillingStatusResponse {
  ok?: boolean;
  billing_interval?: BillingIntervalValue;
  source_surface?: string;
  subscriptionPeriodEnd?: string | null;
}

function isPaidPlan(plan: string): plan is BillingPlan {
  return plan === "pro" || plan === "business";
}

export function BillingSuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { refresh, profile } = useAuth();
  const [confirmedPlan, setConfirmedPlan] = useState<string | null>(null);
  const [polling, setPolling] = useState(Boolean(sessionId));
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const subscriptionCompleteTrackedRef = useRef(false);

  const missingSessionMessage = useMemo(
    () =>
      sessionId
        ? null
        : "Missing checkout session. Your payment may still be processing.",
    [sessionId],
  );

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20;

    function attemptSubscriptionComplete(input: {
      tier: BillingPlan;
      billing_interval: BillingIntervalValue | null | undefined;
      source_surface: string;
      subscriptionPeriodEnd: string | null;
    }): void {
      if (subscriptionCompleteTrackedRef.current) {
        return;
      }
      // Claim once per mount so sync + poll / repeated polls cannot double-attempt.
      subscriptionCompleteTrackedRef.current = true;
      if (!input.billing_interval) {
        return;
      }
      tryTrackSubscriptionComplete({
        tier: input.tier,
        billing_interval: input.billing_interval,
        source_surface: input.source_surface,
        subscriptionPeriodEnd: input.subscriptionPeriodEnd,
      });
    }

    async function pollBillingStatus() {
      // Attempt immediate sync from the completed Checkout Session (no new charge).
      try {
        const syncResponse = await fetch("/api/billing/sync-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (syncResponse.ok) {
          const syncData = (await syncResponse.json()) as SyncSessionSuccessResponse;
          if (syncData.hasActiveSubscription && isPaidPlan(syncData.plan)) {
            attemptSubscriptionComplete({
              tier: syncData.plan,
              billing_interval: syncData.billing_interval,
              source_surface: syncData.source_surface ?? ANALYTICS_SOURCE_SURFACE_UNKNOWN,
              subscriptionPeriodEnd: syncData.subscriptionPeriodEnd ?? null,
            });
            setConfirmedPlan(syncData.plan);
            setPolling(false);
            await refresh();
            router.refresh();
            return;
          }
        }
      } catch {
        // Fall through to polling while webhooks catch up.
      }

      while (!cancelled && attempts < maxAttempts) {
        attempts += 1;
        await refresh();

        try {
          const response = await fetch("/api/billing/status");
          if (response.ok) {
            const data = (await response.json()) as BillingStatusResponse;
            if (data.hasActiveSubscription && isPaidPlan(data.plan)) {
              // Poll fallback: same helper/dedupe/consent path as sync-session.
              attemptSubscriptionComplete({
                tier: data.plan,
                billing_interval: data.billing_interval,
                source_surface: ANALYTICS_SOURCE_SURFACE_UNKNOWN,
                subscriptionPeriodEnd: data.subscriptionCurrentPeriodEnd ?? null,
              });
              setConfirmedPlan(data.plan);
              setPolling(false);
              router.refresh();
              return;
            }
          }
        } catch {
          // Keep polling briefly while webhook processes.
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      if (!cancelled) {
        setSyncMessage(
          "Payment received. Your subscription is still syncing — refresh billing in a few seconds if your plan has not updated yet.",
        );
        setPolling(false);
      }
    }

    void pollBillingStatus();

    return () => {
      cancelled = true;
    };
  }, [sessionId, refresh, router]);

  const effectivePlan = confirmedPlan ?? getEffectivePlan(profile);
  const displayMessage = missingSessionMessage ?? syncMessage;

  return (
    <div className="space-y-6">
      {polling ? (
        <p className="text-sm text-scanonix-muted" role="status">
          Payment received. Confirming your subscription…
        </p>
      ) : confirmedPlan ? (
        <AuthMessage
          type="success"
          message={`Your ${confirmedPlan} plan is active.`}
        />
      ) : displayMessage ? (
        <AuthMessage type="error" message={displayMessage} />
      ) : (
        <AuthMessage
          type="success"
          message={`Your current plan is ${effectivePlan}.`}
        />
      )}

      <p className="text-sm leading-relaxed text-scanonix-muted">
        Scanonix grants paid access only after Stripe webhooks update your
        Supabase profile. This page never upgrades your account directly.
      </p>

      <div className="flex flex-wrap gap-3">
        <ActionButton href="/dashboard">Go to dashboard</ActionButton>
        <ActionButton href="/account/billing" variant="outline">
          Open billing
        </ActionButton>
        {!polling && !hasActiveSubscription(profile) && (
          <ActionButton variant="ghost" onClick={() => void refresh()}>
            Refresh status
          </ActionButton>
        )}
      </div>
    </div>
  );
}
