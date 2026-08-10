/**
 * Diagnose Stripe checkout → webhook → Supabase profile sync.
 * Never prints secret values.
 * Run: node --env-file=.env.local scripts/diagnose-billing-sync.mjs
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() || "";

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function warn(message) {
  console.log(`⚠ ${message}`);
}

function info(message) {
  console.log(`  ${message}`);
}

async function main() {
  section("Environment (presence only)");
  ok(`NEXT_PUBLIC_SITE_URL: ${siteUrl}`);
  ok(`Supabase URL: ${supabaseUrl ? "loaded" : "MISSING"}`);
  ok(`STRIPE_SECRET_KEY: ${stripeSecretKey ? "loaded" : "MISSING"}`);
  ok(`STRIPE_WEBHOOK_SECRET: ${webhookSecret ? "loaded" : "MISSING"}`);
  ok(`SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? "loaded" : "MISSING"}`);

  if (!stripeSecretKey || !supabaseUrl || !serviceRoleKey) {
    console.error("\nCannot continue — missing required configuration.\n");
    process.exit(1);
  }

  const stripe = new Stripe(stripeSecretKey, { typescript: true });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  section("Recent Stripe checkout.session.completed events");
  const checkoutEvents = await stripe.events.list({
    type: "checkout.session.completed",
    limit: 5,
  });

  if (checkoutEvents.data.length === 0) {
    warn("No checkout.session.completed events found in this Stripe account.");
  }

  for (const event of checkoutEvents.data) {
    const session = event.data.object;
    info(`Event ${event.id} @ ${new Date(event.created * 1000).toISOString()}`);
    info(`  Session: ${session.id}`);
    info(`  Status: ${session.status}, payment_status: ${session.payment_status}`);
    info(`  Customer: ${typeof session.customer === "string" ? session.customer : session.customer?.id ?? "none"}`);
    info(`  Subscription: ${typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? "none"}`);
    info(`  client_reference_id: ${session.client_reference_id ?? "none"}`);
    info(`  metadata.supabase_user_id: ${session.metadata?.supabase_user_id ?? "MISSING"}`);
  }

  section("Recent Stripe webhook delivery attempts (checkout.session.completed)");
  if (checkoutEvents.data[0]) {
    const latestEventId = checkoutEvents.data[0].id;
    try {
      const deliveries = await stripe.events.retrieve(latestEventId);
      info(`Latest event ${latestEventId} type=${deliveries.type}`);
    } catch (error) {
      warn(`Could not retrieve latest event details: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  section("Processed webhook events in Supabase (stripe_webhook_events)");
  const { data: webhookRows, error: webhookError } = await admin
    .from("stripe_webhook_events")
    .select("id, type, processed_at")
    .order("processed_at", { ascending: false })
    .limit(10);

  if (webhookError) {
    warn(`Could not read stripe_webhook_events: ${webhookError.message}`);
    if (webhookError.message.includes("does not exist")) {
      warn("Migration 003_billing.sql may not be applied.");
    }
  } else if (!webhookRows?.length) {
    warn("No processed webhook events recorded — webhooks may not have reached the app or all failed before markEventProcessed.");
  } else {
    for (const row of webhookRows) {
      info(`${row.processed_at} — ${row.type} (${row.id.slice(0, 20)}…)`);
    }
  }

  section("Profiles with Stripe customer but no active paid plan");
  const { data: mismatchedProfiles, error: profileError } = await admin
    .from("profiles")
    .select(
      "id, full_name, plan, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_price_id",
    )
    .not("stripe_customer_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (profileError) {
    warn(`Could not read profiles: ${profileError.message}`);
  } else if (!mismatchedProfiles?.length) {
    info("No profiles with stripe_customer_id found.");
  } else {
    for (const profile of mismatchedProfiles) {
      const active = profile.plan !== "free" && profile.subscription_status === "active";
      info(
        `${profile.full_name ?? profile.id.slice(0, 8)} — plan=${profile.plan}, status=${profile.subscription_status ?? "null"}, customer=${profile.stripe_customer_id?.slice(0, 12)}…, sub=${profile.stripe_subscription_id ?? "null"}`,
      );
      if (!active && profile.stripe_customer_id) {
        warn("  ^ Possible unsynced checkout (customer linked, plan not active)");
      }
    }
  }

  section("Webhook endpoint reachability");
  if (!webhookSecret) {
    warn("Skipping live webhook probe — STRIPE_WEBHOOK_SECRET missing");
  } else {
    const probePayload = JSON.stringify({
      id: `evt_probe_${Date.now()}`,
      object: "event",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_probe", object: "subscription" } },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: probePayload,
      secret: webhookSecret,
    });

    try {
      const response = await fetch(`${siteUrl}/api/stripe/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": signature,
        },
        body: probePayload,
      });
      info(`POST ${siteUrl}/api/stripe/webhook → HTTP ${response.status}`);
      if (response.status === 500) {
        warn("Webhook handler returned 500 — check Next.js server logs for processing errors.");
      } else if (response.status === 400) {
        warn("Webhook signature rejected — STRIPE_WEBHOOK_SECRET may not match Stripe CLI whsec.");
      }
    } catch (error) {
      warn(`Could not reach webhook endpoint: ${error instanceof Error ? error.message : String(error)}`);
      warn("Is the Next.js dev server running at NEXT_PUBLIC_SITE_URL?");
    }
  }

  console.log("");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
