/**
 * Sync the latest completed Checkout Session to Supabase without charging again.
 * Never prints secrets.
 * Run: node --env-file=.env.local scripts/sync-existing-subscription.mjs [checkout_session_id]
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() || "";

async function main() {
  const sessionIdArg = process.argv[2]?.trim();
  const stripe = new Stripe(stripeSecretKey, { typescript: true });

  let event;
  if (sessionIdArg?.startsWith("cs_")) {
    const session = await stripe.checkout.sessions.retrieve(sessionIdArg);
    event = {
      id: `evt_manual_sync_${Date.now()}`,
      object: "event",
      type: "checkout.session.completed",
      data: { object: session },
    };
  } else {
    const events = await stripe.events.list({
      type: "checkout.session.completed",
      limit: 1,
    });
    if (!events.data.length) {
      console.error("No checkout.session.completed events found.");
      process.exit(1);
    }
    event = events.data[0];
  }

  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });

  console.log(`Syncing ${event.data.object.id} via webhook handler …`);

  const response = await fetch(`${siteUrl}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });

  if (response.status !== 200) {
    const body = await response.text();
    console.error(`Webhook sync failed: HTTP ${response.status}`);
    console.error(body.slice(0, 300));
    process.exit(1);
  }

  const userId =
    event.data.object.metadata?.supabase_user_id ??
    event.data.object.client_reference_id;

  if (!userId) {
    console.log("✓ Webhook accepted (could not verify profile — no user id on session).");
    return;
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("plan, subscription_status, stripe_subscription_id")
    .eq("id", userId)
    .single();

  console.log("✓ Profile after sync:", profile);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
