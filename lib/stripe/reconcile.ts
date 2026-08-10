import type Stripe from "stripe";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/stripe/server";
import { getStripe } from "@/lib/stripe/server";
import { findUserIdByStripeCustomerId } from "@/lib/stripe/customer";
import {
  clearProfileSubscription,
  syncSubscriptionToProfile,
} from "@/lib/stripe/subscription";

export type SubscriptionBucket =
  | "active"
  | "cancel_at_period_end"
  | "cancelled"
  | "other";

export interface SubscriptionSummary {
  id: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  bucket: SubscriptionBucket;
  priceId: string | null;
  currentPeriodEnd: string | null;
  created: string;
}

export interface ReconcileResult {
  userId: string;
  customerId: string;
  subscriptions: SubscriptionSummary[];
  authoritativeSubscriptionId: string | null;
  action: "synced" | "downgraded" | "unchanged";
  profilePlan: string | null;
  profileSubscriptionId: string | null;
}

function maskStripeId(id: string): string {
  if (id.length <= 8) {
    return id;
  }

  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function getSubscriptionBucket(subscription: Stripe.Subscription): SubscriptionBucket {
  if (subscription.status === "canceled") {
    return "cancelled";
  }

  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    return "other";
  }

  if (subscription.cancel_at_period_end) {
    return "cancel_at_period_end";
  }

  return "active";
}

function getPeriodEndIso(subscription: Stripe.Subscription): string | null {
  const unix =
    subscription.items.data[0]?.current_period_end ??
    ("current_period_end" in subscription
      ? (subscription as Stripe.Subscription & { current_period_end?: number })
          .current_period_end ?? null
      : null);

  return unix ? new Date(unix * 1000).toISOString() : null;
}

export function summarizeSubscription(
  subscription: Stripe.Subscription,
): SubscriptionSummary {
  return {
    id: maskStripeId(subscription.id),
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    bucket: getSubscriptionBucket(subscription),
    priceId: subscription.items.data[0]?.price?.id ?? null,
    currentPeriodEnd: getPeriodEndIso(subscription),
    created: new Date(subscription.created * 1000).toISOString(),
  };
}

/** Pick the subscription Scanonix should treat as source of truth. */
export function pickAuthoritativeSubscription(
  subscriptions: Stripe.Subscription[],
): Stripe.Subscription | null {
  const usable = subscriptions.filter((subscription) =>
    ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status),
  );

  if (usable.length === 0) {
    return null;
  }

  usable.sort((a, b) => {
    if (a.cancel_at_period_end !== b.cancel_at_period_end) {
      return a.cancel_at_period_end ? 1 : -1;
    }

    return b.created - a.created;
  });

  return usable[0] ?? null;
}

export async function listCustomerSubscriptions(
  customerId: string,
): Promise<Stripe.Subscription[]> {
  const stripe = getStripe();
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  return subscriptions.data;
}

export async function reconcileCustomerBilling(
  customerId: string,
  explicitUserId?: string | null,
): Promise<ReconcileResult> {
  const userId =
    explicitUserId ?? (await findUserIdByStripeCustomerId(customerId));

  if (!userId) {
    throw new Error(`No Supabase user linked to customer ${maskStripeId(customerId)}`);
  }

  const subscriptions = await listCustomerSubscriptions(customerId);
  const summaries = subscriptions.map(summarizeSubscription);
  const authoritative = pickAuthoritativeSubscription(subscriptions);

  const admin = await import("@/lib/supabase/admin").then((m) => m.createAdminClient());
  const { data: beforeProfile } = await admin
    .from("profiles")
    .select("plan, stripe_subscription_id, subscription_status")
    .eq("id", userId)
    .single();

  let action: ReconcileResult["action"] = "unchanged";

  if (!authoritative) {
    await clearProfileSubscription(userId);
    action =
      beforeProfile?.plan === "free" && !beforeProfile?.stripe_subscription_id
        ? "unchanged"
        : "downgraded";
  } else {
    await syncSubscriptionToProfile(authoritative, userId);
    action =
      beforeProfile?.stripe_subscription_id === authoritative.id &&
      beforeProfile?.subscription_status === authoritative.status
        ? "unchanged"
        : "synced";
  }

  const { data: afterProfile } = await admin
    .from("profiles")
    .select("plan, stripe_subscription_id, subscription_status, cancel_at_period_end")
    .eq("id", userId)
    .single();

  return {
    userId: maskStripeId(userId),
    customerId: maskStripeId(customerId),
    subscriptions: summaries,
    authoritativeSubscriptionId: authoritative
      ? maskStripeId(authoritative.id)
      : null,
    action,
    profilePlan: afterProfile?.plan ?? null,
    profileSubscriptionId: afterProfile?.stripe_subscription_id
      ? maskStripeId(afterProfile.stripe_subscription_id)
      : null,
  };
}

export { maskStripeId };
