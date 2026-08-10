import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { getEffectivePlan, hasActiveSubscription } from "@/lib/auth/entitlements";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const profile = user.profile;

  return NextResponse.json({
    plan: getEffectivePlan(profile),
    storedPlan: profile?.plan ?? "free",
    subscriptionStatus: profile?.subscription_status ?? null,
    subscriptionPriceId: profile?.subscription_price_id ?? null,
    subscriptionCurrentPeriodEnd: profile?.subscription_current_period_end ?? null,
    cancelAtPeriodEnd: profile?.cancel_at_period_end ?? false,
    hasActiveSubscription: hasActiveSubscription(profile),
    stripeCustomerId: profile?.stripe_customer_id ?? null,
  });
}
