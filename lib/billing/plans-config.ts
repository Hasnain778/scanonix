import type { BillingInterval, BillingPlan } from "@/types/auth";

export interface PricingCardConfig {
  key: string;
  plan: BillingPlan | "free";
  interval?: BillingInterval;
  name: string;
  price: string;
  period: string;
  description: string;
  savings?: string;
  highlighted?: boolean;
}

export const PRICING_CARDS: PricingCardConfig[] = [
  {
    key: "free",
    plan: "free",
    name: "Free",
    price: "£0",
    period: "forever",
    description: "HD background removal and core tools in your browser.",
  },
  {
    key: "pro-monthly",
    plan: "pro",
    interval: "monthly",
    name: "Pro Monthly",
    price: "£9.99",
    period: "per month",
    description: "4K exports, premium AI tools, and cloud storage.",
    highlighted: true,
  },
  {
    key: "pro-yearly",
    plan: "pro",
    interval: "yearly",
    name: "Pro Yearly",
    price: "£99",
    period: "per year",
    description: "Everything in Pro, billed annually.",
    savings: "Save ~17% vs monthly",
  },
  {
    key: "business-monthly",
    plan: "business",
    interval: "monthly",
    name: "Business Monthly",
    price: "£29.99",
    period: "per month",
    description: "Batch processing and business workspace features.",
  },
  {
    key: "business-yearly",
    plan: "business",
    interval: "yearly",
    name: "Business Yearly",
    price: "£299",
    period: "per year",
    description: "Everything in Business, billed annually.",
    savings: "Save ~17% vs monthly",
  },
];
