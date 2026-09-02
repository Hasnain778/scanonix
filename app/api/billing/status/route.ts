import { NextResponse } from "next/server";
import { billingIntervalToAnalytics } from "@/lib/analytics/checkout-metadata";
import { getAuthUser } from "@/lib/auth/session";
import { getEffectivePlan, hasActiveSubscription } from "@/lib/auth/entitlements";
import { mapPriceIdToBillingInterval } from "@/lib/stripe/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const profile = user.profile;
  const billingInterval = mapPriceIdToBillingInterval(profile?.subscription_price_id);

  return NextResponse.json({
    plan: getEffectivePlan(profile),
    storedPlan: profile?.plan ?? "free",
    subscriptionStatus: profile?.subscription_status ?? null,
    subscriptionPriceId: profile?.subscription_price_id ?? null,
    subscriptionCurrentPeriodEnd: profile?.subscription_current_period_end ?? null,
    cancelAtPeriodEnd: profile?.cancel_at_period_end ?? false,
    hasActiveSubscription: hasActiveSubscription(profile),
    stripeCustomerId: profile?.stripe_customer_id ?? null,
    /** Safe analytics field for poll-path subscription_complete (never a Stripe id). */
    billing_interval: billingInterval
      ? billingIntervalToAnalytics(billingInterval)
      : null,
  });
}
