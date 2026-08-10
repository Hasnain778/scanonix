/**
 * Check profile billing state for user linked to latest checkout (no secrets).
 * Run: node --env-file=.env.local scripts/check-profile-billing.mjs
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() || "";

async function main() {
  const stripe = new Stripe(stripeSecretKey, { typescript: true });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const events = await stripe.events.list({
    type: "checkout.session.completed",
    limit: 1,
  });
  const userId = events.data[0]?.data?.object?.metadata?.supabase_user_id;
  if (!userId) {
    console.error("No user id on latest checkout event.");
    process.exit(1);
  }

  const { data: profile, error } = await admin
    .from("profiles")
    .select(
      "id, full_name, plan, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_price_id, subscription_current_period_end, cancel_at_period_end",
    )
    .eq("id", userId)
    .single();

  if (error || !profile) {
    console.error(`Profile read failed: ${error?.message ?? "missing"}`);
    process.exit(1);
  }

  console.log(JSON.stringify(profile, null, 2));

  const { data: webhookRows } = await admin
    .from("stripe_webhook_events")
    .select("id, type, processed_at")
    .order("processed_at", { ascending: false })
    .limit(5);

  console.log("\nRecent webhook events:");
  for (const row of webhookRows ?? []) {
    console.log(`  ${row.processed_at} ${row.type} ${row.id.slice(0, 24)}…`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
