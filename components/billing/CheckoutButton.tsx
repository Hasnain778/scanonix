"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/ActionButton";
import { useAuth } from "@/components/auth/AuthProvider";
import type { BillingInterval, BillingPlan } from "@/types/auth";

interface CheckoutButtonProps {
  plan: BillingPlan;
  interval: BillingInterval;
  label: string;
  disabled?: boolean;
  variant?: "primary" | "outline" | "secondary";
  className?: string;
}

export function CheckoutButton({
  plan,
  interval,
  label,
  disabled = false,
  variant = "primary",
  className,
}: CheckoutButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setError(null);

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent("/pricing")}`);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        setError(data.error ?? "Could not start checkout.");
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Checkout is unavailable. Please try again.");
      setLoading(false);
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
