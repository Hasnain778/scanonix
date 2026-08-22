"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/ActionButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { ANALYTICS_SURFACES, type AnalyticsSurface } from "@/lib/analytics/surfaces";
import { trackEvent } from "@/lib/analytics/ga4";
import type { BillingInterval, BillingPlan } from "@/types/auth";

interface CheckoutButtonProps {
  plan: BillingPlan;
  interval: BillingInterval;
  label: string;
  disabled?: boolean;
  variant?: "primary" | "outline" | "secondary";
  className?: string;
  /** Low-cardinality checkout attribution surface (required for checkout_start). */
  sourceSurface?: AnalyticsSurface;
}

function toCheckoutBillingInterval(interval: BillingInterval): "month" | "year" {
  return interval === "monthly" ? "month" : "year";
}

export function CheckoutButton({
  plan,
  interval,
  label,
  disabled = false,
  variant = "primary",
  className,
  sourceSurface = ANALYTICS_SURFACES.PRICING,
}: CheckoutButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkoutTrackedRef = useRef(false);

  async function handleCheckout() {
    setError(null);

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent("/pricing")}`);
      return;
    }

    if (loading || checkoutTrackedRef.current) {
      return;
    }

    checkoutTrackedRef.current = true;
    trackEvent("checkout_start", {
      tier: plan,
      billing_interval: toCheckoutBillingInterval(interval),
      source_surface: sourceSurface,
    });

    setLoading(true);

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval, source_surface: sourceSurface }),
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        setError(data.error ?? "Could not start checkout.");
        setLoading(false);
        checkoutTrackedRef.current = false;
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Checkout is unavailable. Please try again.");
      setLoading(false);
      checkoutTrackedRef.current = false;
    }
  }

  return (
    <div className={className}>
      <ActionButton
        type="button"
        variant={variant}
        size="lg"
        className="w-full"
        loading={loading}
        disabled={disabled || loading}
        onClick={handleCheckout}
      >
        {label}
      </ActionButton>
      {error && (
        <p className="mt-2 text-center text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * checkout_start fires synchronously when an authenticated user initiates checkout
 * (before the Stripe session API call). If session creation fails, the event
 * has already been emitted for that attempt; the button re-enables and allows retry.
 */
