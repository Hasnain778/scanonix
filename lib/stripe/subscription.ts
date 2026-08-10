import type Stripe from "stripe";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/stripe/server";
import { mapPriceIdToPlan } from "@/lib/stripe/plans";
import { findUserIdByStripeCustomerId } from "@/lib/stripe/customer";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserPlan } from "@/types/auth";

interface ProfileBillingUpdate {
  plan: UserPlan;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  subscription_price_id?: string | null;
  subscription_current_period_end?: string | null;
  cancel_at_period_end?: boolean;
}

function getPrimaryPriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.price?.id ?? null;
}

function resolvePlanFromSubscription(
  subscription: Stripe.Subscription,
): UserPlan {
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    return "free";
  }

  return mapPriceIdToPlan(getPrimaryPriceId(subscription));
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  return (
    subscription.items.data[0]?.current_period_end ??
    ("current_period_end" in subscription
      ? (subscription as Stripe.Subscription & { current_period_end?: number })
          .current_period_end ?? null
      : null)
  );
}

function subscriptionToProfileUpdate(
  subscription: Stripe.Subscription,
  customerId?: string | null,
): ProfileBillingUpdate {
  const priceId = getPrimaryPriceId(subscription);
  const plan = resolvePlanFromSubscription(subscription);
  const periodEndUnix = getSubscriptionPeriodEnd(subscription);
  const periodEnd = periodEndUnix
    ? new Date(periodEndUnix * 1000).toISOString()
    : null;

  return {
    plan,
    stripe_customer_id: customerId ?? (subscription.customer as string | null),
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    subscription_price_id: priceId,
    subscription_current_period_end: periodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end,
  };
}

export async function updateProfileBilling(
  userId: string,
  update: ProfileBillingUpdate,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update(update).eq("id", userId);

  if (error) {
    throw new Error(`Failed to update profile billing: ${error.message}`);
  }
}

export async function clearProfileSubscription(userId: string): Promise<void> {
  await updateProfileBilling(userId, {
    plan: "free",
    stripe_subscription_id: null,
    subscription_status: "canceled",
    subscription_price_id: null,
    subscription_current_period_end: null,
    cancel_at_period_end: false,
  });
}

export async function syncSubscriptionToProfile(
  subscription: Stripe.Subscription,
  explicitUserId?: string | null,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  const metadataUserId =
    explicitUserId ??
    subscription.metadata.supabase_user_id ??
    (customerId ? await findUserIdByStripeCustomerId(customerId) : null);

  if (!metadataUserId) {
    throw new Error(
      `Could not resolve Supabase user for subscription ${subscription.id}`,
    );
  }

  await updateProfileBilling(
    metadataUserId,
    subscriptionToProfileUpdate(subscription, customerId ?? null),
  );
}

export async function syncCheckoutSessionToProfile(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.supabase_user_id;
  if (!userId) {
    throw new Error(`Checkout session ${session.id} missing supabase_user_id metadata`);
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;

  if (session.mode === "subscription" && session.subscription) {
    const { getStripe } = await import("@/lib/stripe/server");
    const stripe = getStripe();
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncSubscriptionToProfile(subscription, userId);
    return;
  }

  if (customerId) {
    await updateProfileBilling(userId, {
      plan: "free",
      stripe_customer_id: customerId,
    });
  }
}

export async function resolveUserIdFromStripeObject(
  metadata: Stripe.Metadata | null | undefined,
  customerId: string | null | undefined,
): Promise<string | null> {
  if (metadata?.supabase_user_id) {
    return metadata.supabase_user_id;
  }

  if (customerId) {
    return findUserIdByStripeCustomerId(customerId);
  }

  return null;
}

export { resolvePlanFromSubscription, subscriptionToProfileUpdate };
