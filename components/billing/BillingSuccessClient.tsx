"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ActionButton } from "@/components/ui/ActionButton";
import { AuthMessage } from "@/components/auth/AuthShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { getEffectivePlan, hasActiveSubscription } from "@/lib/auth/entitlements";

interface BillingStatusResponse {
  plan: string;
  storedPlan: string;
  subscriptionStatus: string | null;
  hasActiveSubscription: boolean;
}

export function BillingSuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { refresh, profile } = useAuth();
  const [confirmedPlan, setConfirmedPlan] = useState<string | null>(null);
  const [polling, setPolling] = useState(Boolean(sessionId));
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

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

    async function pollBillingStatus() {
      // Attempt immediate sync from the completed Checkout Session (no new charge).
      try {
        const syncResponse = await fetch("/api/billing/sync-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (syncResponse.ok) {
          const syncData = (await syncResponse.json()) as BillingStatusResponse & {
            ok?: boolean;
          };
          if (syncData.hasActiveSubscription && syncData.plan !== "free") {
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
            if (data.hasActiveSubscription && data.plan !== "free") {
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
