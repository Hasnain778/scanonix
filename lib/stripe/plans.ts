import { env } from "@/config/env";
import type { BillingInterval, BillingPlan, UserPlan } from "@/types/auth";

export interface PlanOption {
  plan: BillingPlan;
  interval: BillingInterval;
  priceId: string;
  label: string;
  amountLabel: string;
  yearlySavingsLabel?: string;
}

const PLAN_LABELS: Record<BillingPlan, string> = {
  pro: "Pro",
  business: "Business",
};

const INTERVAL_LABELS: Record<BillingInterval, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
};

export function getStripePriceId(
  plan: BillingPlan,
  interval: BillingInterval,
): string {
  const mapping: Record<BillingPlan, Record<BillingInterval, string>> = {
    pro: {
      monthly: env.stripeProMonthlyPriceId,
      yearly: env.stripeProYearlyPriceId,
    },
    business: {
      monthly: env.stripeBusinessMonthlyPriceId,
      yearly: env.stripeBusinessYearlyPriceId,
    },
  };

  const priceId = mapping[plan][interval];
  if (!priceId) {
    throw new Error(`Missing Stripe price ID for ${plan} ${interval}`);
  }

  return priceId;
}

export function isApprovedCheckoutPlan(
  plan: string | undefined,
  interval: string | undefined,
): plan is BillingPlan {
  return (
    (plan === "pro" || plan === "business") &&
    (interval === "monthly" || interval === "yearly")
  );
}

export function mapPriceIdToPlan(priceId: string | null | undefined): UserPlan {
  if (!priceId) {
    return "free";
  }

  if (
    priceId === env.stripeProMonthlyPriceId ||
    priceId === env.stripeProYearlyPriceId
  ) {
    return "pro";
  }

  if (
    priceId === env.stripeBusinessMonthlyPriceId ||
    priceId === env.stripeBusinessYearlyPriceId
  ) {
    return "business";
  }

  return "free";
}

export function getPlanOptionLabel(plan: BillingPlan, interval: BillingInterval): string {
  return `${PLAN_LABELS[plan]} ${INTERVAL_LABELS[interval]}`;
}

export function listCheckoutPlans(): PlanOption[] {
  const plans: PlanOption[] = [
    {
      plan: "pro",
      interval: "monthly",
      priceId: env.stripeProMonthlyPriceId,
      label: "Pro Monthly",
      amountLabel: "£9.99 / month",
    },
    {
      plan: "pro",
      interval: "yearly",
      priceId: env.stripeProYearlyPriceId,
      label: "Pro Yearly",
      amountLabel: "£99 / year",
      yearlySavingsLabel: "Save ~17% vs monthly",
    },
    {
      plan: "business",
      interval: "monthly",
      priceId: env.stripeBusinessMonthlyPriceId,
      label: "Business Monthly",
      amountLabel: "£29.99 / month",
    },
    {
      plan: "business",
      interval: "yearly",
      priceId: env.stripeBusinessYearlyPriceId,
      label: "Business Yearly",
      amountLabel: "£299 / year",
      yearlySavingsLabel: "Save ~17% vs monthly",
    },
  ];

  return plans.filter((option) => Boolean(option.priceId));
}

export function isSameActivePlan(
  profilePlan: UserPlan,
  profilePriceId: string | null,
  plan: BillingPlan,
  interval: BillingInterval,
): boolean {
  if (profilePlan !== plan) {
    return false;
  }

  const expectedPriceId = getStripePriceId(plan, interval);
  return profilePriceId === expectedPriceId;
}
