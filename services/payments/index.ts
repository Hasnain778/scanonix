import type { BillingInterval, UserPlan } from "@/types/auth";

export type SubscriptionTier = UserPlan;

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  active: boolean;
  currentPeriodEnd: string | null;
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const response = await fetch("/api/billing/status", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    return { tier: "free", active: false, currentPeriodEnd: null };
  }

  const data = (await response.json()) as {
    plan: UserPlan;
    hasActiveSubscription: boolean;
    subscriptionCurrentPeriodEnd: string | null;
  };

  return {
    tier: data.plan,
    active: data.hasActiveSubscription,
    currentPeriodEnd: data.subscriptionCurrentPeriodEnd,
  };
}

export async function createCheckoutSession(input: {
  plan: Exclude<UserPlan, "free">;
  interval: BillingInterval;
}): Promise<{ url: string }> {
  const response = await fetch("/api/stripe/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !data.url) {
    throw new Error(data.error ?? "Could not start checkout.");
  }

  return { url: data.url };
}

export async function createPortalSession(): Promise<{ url: string }> {
  const response = await fetch("/api/stripe/create-portal-session", {
    method: "POST",
  });

  const data = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !data.url) {
    throw new Error(data.error ?? "Could not open billing portal.");
  }

  return { url: data.url };
}
