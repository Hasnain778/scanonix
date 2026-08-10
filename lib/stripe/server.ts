import Stripe from "stripe";
import { assertStripeConfigured, env } from "@/config/env";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    assertStripeConfigured();
    stripeClient = new Stripe(env.stripeSecretKey, {
      typescript: true,
    });
  }

  return stripeClient;
}

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
]);
