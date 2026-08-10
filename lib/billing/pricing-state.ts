import { hasActiveSubscription } from "@/lib/auth/entitlements";
import { isSameActivePlan } from "@/lib/stripe/plans";
import { PRICING_CARDS } from "@/lib/billing/plans-config";
import type { Profile } from "@/types/auth";

export function resolveActivePricingPlanKey(profile: Profile | null): string | null {
  if (!profile) {
    return null;
  }

  if (!hasActiveSubscription(profile)) {
    return profile.plan === "free" ? "free" : null;
  }

  for (const card of PRICING_CARDS) {
    if (
      card.plan !== "free" &&
      card.interval &&
      isSameActivePlan(
        profile.plan,
        profile.subscription_price_id ?? null,
        card.plan,
        card.interval,
      )
    ) {
      return card.key;
    }
  }

  return null;
}
