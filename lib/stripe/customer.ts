import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/types/auth";

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  profile: Profile | null,
): Promise<string> {
  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    metadata: {
      supabase_user_id: userId,
    },
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  if (error) {
    throw new Error(`Failed to store Stripe customer ID: ${error.message}`);
  }

  return customer.id;
}

export async function findUserIdByStripeCustomerId(
  customerId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve user by Stripe customer: ${error.message}`);
  }

  return data?.id ?? null;
}
