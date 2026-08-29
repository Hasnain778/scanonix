"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { ActionButton } from "@/components/ui/ActionButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { ANALYTICS_SURFACES } from "@/lib/analytics/surfaces";
import { getEffectivePlan } from "@/lib/auth/entitlements";
import type { BillingInterval } from "@/types/auth";

interface PricingPagePlansProps {
  activePlanKey?: string | null;
}

interface PlanTier {
  id: "free" | "pro" | "business";
  name: string;
  subtitle: string;
  prices: Record<BillingInterval, string>;
  suffix: Record<BillingInterval, string>;
  features: string[];
  highlighted?: boolean;
  cta: {
    label: string;
    href?: string;
    checkout?: { plan: "pro" | "business" };
    variant: "outline" | "primary" | "secondary";
  };
}

const PLANS: PlanTier[] = [
  {
    id: "free",
    name: "Free",
    subtitle: "Perfect for trying Scanonix.",
    prices: { monthly: "£0", yearly: "£0" },
    suffix: { monthly: "", yearly: "" },
    features: [
      "Basic website scanning",
      "Basic file scanning",
      "Standard quality background removal",
      "Limited AI analysis",
      "Limited scan history",
      "Community support",
    ],
    cta: {
      label: "Get Started Free",
      href: "/register",
      variant: "outline",
    },
  },
  {
    id: "pro",
    name: "Pro",
    subtitle: "Everything you need for personal and professional use.",
    prices: { monthly: "£9.99", yearly: "£99" },
    suffix: { monthly: "/month", yearly: "/year" },
    highlighted: true,
    features: [
      "Everything in Free",
      "4K Background Removal",
      "Higher AI usage (500 ops/month)",
      "Expanded security scans (500 ops/month)",
      "Expanded tool usage limits",
      "Full scan history in your account",
      "Faster processing",
      "Priority support",
    ],
    cta: {
      label: "Upgrade to Pro",
      checkout: { plan: "pro" },
      variant: "primary",
    },
  },
  {
    id: "business",
    name: "Business",
    subtitle: "Built for teams and businesses.",
    prices: { monthly: "£29.99", yearly: "£299" },
    suffix: { monthly: "/month", yearly: "/year" },
    features: [
      "Everything in Pro",
      "Team workspace",
      "Batch processing",
      "Shared reports",
      "API access",
      "Admin controls",
      "Priority support",
    ],
    cta: {
      label: "Contact Sales",
      checkout: { plan: "business" },
      variant: "secondary",
    },
  },
];

function isCurrentPlan(
  planId: PlanTier["id"],
  activePlanKey: string | null,
  effectivePlan: string,
): boolean {
  if (planId === "free") {
    return activePlanKey === "free" || effectivePlan === "free";
  }
  if (planId === "pro") {
    return activePlanKey?.startsWith("pro-") === true || effectivePlan === "pro";
  }
  return activePlanKey?.startsWith("business-") === true || effectivePlan === "business";
}

function BillingToggle({
  interval,
  onChange,
}: {
  interval: BillingInterval;
  onChange: (value: BillingInterval) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative inline-flex rounded-xl border border-border bg-surface-muted p-1 shadow-[var(--shadow-soft)]"
        role="group"
        aria-label="Billing interval"
      >
        <motion.div
          className="absolute inset-y-1 rounded-lg bg-brand shadow-[0_0_20px_rgba(255,106,0,0.35)]"
          layout
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          style={{
            left: interval === "monthly" ? "4px" : "50%",
            right: interval === "monthly" ? "50%" : "4px",
          }}
        />
        <button
          type="button"
          className={`relative z-10 min-w-[108px] rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
            interval === "monthly"
              ? "text-on-brand"
              : "text-foreground-muted hover:text-foreground"
          }`}
          aria-pressed={interval === "monthly"}
          onClick={() => onChange("monthly")}
        >
          Monthly
        </button>
        <button
          type="button"
          className={`relative z-10 min-w-[108px] rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
            interval === "yearly"
              ? "text-on-brand"
              : "text-foreground-muted hover:text-foreground"
          }`}
          aria-pressed={interval === "yearly"}
          onClick={() => onChange("yearly")}
        >
          Yearly
        </button>
      </div>

      <AnimatePresence mode="wait">
        {interval === "yearly" ? (
          <motion.p
            key="savings"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-sm font-medium text-scanonix-orange"
          >
            Save 17%
          </motion.p>
        ) : (
          <motion.span
            key="spacer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="block h-5"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PlanPrice({
  price,
  suffix,
  interval,
}: {
  price: string;
  suffix: string;
  interval: BillingInterval;
}) {
  return (
    <div className="mt-6 flex items-end gap-1">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${price}-${suffix}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex items-end gap-1"
        >
          <span className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{price}</span>
          {suffix ? (
            <span className="mb-1.5 text-base text-foreground-muted">{suffix}</span>
          ) : null}
        </motion.div>
      </AnimatePresence>
      <span className="sr-only">{interval === "yearly" ? "yearly billing" : "monthly billing"}</span>
    </div>
  );
}

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="mt-8 space-y-3.5">
      {features.map((feature) => (
        <li key={feature} className="flex items-start gap-3 text-sm leading-relaxed text-foreground-muted">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

export function PricingPagePlans({ activePlanKey = null }: PricingPagePlansProps) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const { user, profile } = useAuth();
  const effectivePlan = getEffectivePlan(profile);
  const resolvedActiveKey = activePlanKey ?? (effectivePlan === "free" ? "free" : null);

  return (
    <div>
      <div className="mb-12 flex justify-center">
        <BillingToggle interval={interval} onChange={setInterval} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 xl:items-center">
        {PLANS.map((plan) => {
          const isCurrent = isCurrentPlan(plan.id, resolvedActiveKey, effectivePlan);
          const price = plan.prices[interval];
          const suffix = plan.suffix[interval];

          return (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border p-8 backdrop-blur-xl transition-[border-color,box-shadow,transform] duration-300 ${
                plan.highlighted
                  ? "glass-card border-scanonix-orange/40 shadow-[0_0_0_1px_rgba(255,106,0,0.15),0_20px_60px_rgba(255,106,0,0.12)] xl:scale-[1.03]"
                  : "glass-card shadow-lg hover:border-border-strong hover:shadow-xl"
              } ${plan.id === "business" ? "md:col-span-2 md:mx-auto md:max-w-md xl:col-span-1 xl:max-w-none" : ""}`}
            >
              {plan.highlighted ? (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-brand px-4 py-1 text-[11px] font-bold tracking-wide text-on-brand shadow-[0_4px_20px_rgba(255,106,0,0.4)]">
                    MOST POPULAR
                  </span>
                </div>
              ) : null}

              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {plan.name}
                    {plan.highlighted ? (
                      <span className="ml-1.5" aria-hidden="true">
                        ⭐
                      </span>
                    ) : null}
                  </h3>
                  <p className="mt-2 text-sm text-foreground-muted">{plan.subtitle}</p>
                </div>
                {isCurrent ? (
                  <span className="shrink-0 rounded-full border border-border bg-surface-muted px-3 py-1 text-xs font-medium text-foreground">
                    Current
                  </span>
                ) : null}
              </div>

              <PlanPrice price={price} suffix={suffix} interval={interval} />

              <FeatureList features={plan.features} />

              <div className="mt-10">
                {plan.cta.checkout ? (
                  <CheckoutButton
                    plan={plan.cta.checkout.plan}
                    interval={interval}
                    label={isCurrent ? "Current plan" : plan.cta.label}
                    disabled={isCurrent}
                    variant={plan.cta.variant}
                    sourceSurface={ANALYTICS_SURFACES.PRICING}
                  />
                ) : user ? (
                  <ActionButton href="/dashboard" variant="outline" size="lg" className="w-full">
                    Go to dashboard
                  </ActionButton>
                ) : (
                  <ActionButton href={plan.cta.href ?? "/register"} variant="outline" size="lg" className="w-full">
                    {plan.cta.label}
                  </ActionButton>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
