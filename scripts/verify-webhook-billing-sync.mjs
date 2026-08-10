/**
 * Verifies Stripe webhooks update profile billing fields via service role.
 * Never prints secret values.
 * Run: node --env-file=.env.local scripts/verify-webhook-billing-sync.mjs
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() || "";
const proMonthlyPriceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID?.trim() || "";

function fail(message) {
  console.error(`\n✗ Webhook billing sync verification failed: ${message}\n`);
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

async function postSignedWebhook(stripe, payload) {
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });

  const response = await fetch(`${siteUrl}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });

  return response;
}

function buildSubscriptionEvent(type, eventId, userId, subscriptionId, customerId, status) {
  const periodEnd = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  return {
    id: eventId,
    object: "event",
    type,
    data: {
      object: {
        id: subscriptionId,
        object: "subscription",
        customer: customerId,
        status,
        cancel_at_period_end: false,
        metadata: {
          supabase_user_id: userId,
        },
        items: {
          data: [
            {
              current_period_end: periodEnd,
              price: {
                id: proMonthlyPriceId,
              },
            },
          ],
        },
      },
    },
  };
}

async function main() {
  console.log("\nVerifying Stripe webhook → profile billing sync …\n");

  if (!serviceRoleKey) {
    fail("SUPABASE_SERVICE_ROLE_KEY is not loaded");
  }
  ok("SUPABASE_SERVICE_ROLE_KEY loaded");

  if (!webhookSecret || !stripeSecretKey || !proMonthlyPriceId) {
    fail("Stripe webhook/secret/price configuration incomplete");
  }
  ok("Stripe webhook configuration loaded");

  if (!supabaseUrl) {
    fail("NEXT_PUBLIC_SUPABASE_URL is not loaded");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stripe = new Stripe(stripeSecretKey, { typescript: true });
  const testEmail = `webhook-billing-${randomUUID().slice(0, 8)}@scanonix.test`;
  const testPassword = `Test-${randomUUID().slice(0, 12)}!`;
  const subscriptionId = `sub_test_${randomUUID().slice(0, 8)}`;
  const customerId = `cus_test_${randomUUID().slice(0, 8)}`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: "Webhook Billing Verify" },
  });

  if (createError || !created.user) {
    fail(`Could not create test user: ${createError?.message ?? "unknown"}`);
  }

  const userId = created.user.id;
  ok("Temporary test user created");

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const activateEvent = buildSubscriptionEvent(
    "customer.subscription.updated",
    `evt_${randomUUID()}`,
    userId,
    subscriptionId,
    customerId,
    "active",
  );
  const activatePayload = JSON.stringify(activateEvent);

  const activateResponse = await postSignedWebhook(stripe, activatePayload);
  if (activateResponse.status !== 200) {
    await admin.auth.admin.deleteUser(userId);
    fail(`Active subscription webhook returned ${activateResponse.status}`);
  }
  ok("Active subscription webhook accepted");

  const { data: activeProfile, error: activeProfileError } = await admin
    .from("profiles")
    .select(
      "plan, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_price_id, subscription_current_period_end, cancel_at_period_end",
    )
    .eq("id", userId)
    .single();

  if (activeProfileError || !activeProfile) {
    await admin.auth.admin.deleteUser(userId);
    fail(`Could not read updated profile: ${activeProfileError?.message ?? "missing"}`);
  }

  if (activeProfile.plan !== "pro") {
    await admin.auth.admin.deleteUser(userId);
    fail(`Expected plan "pro", got "${activeProfile.plan ?? "null"}"`);
  }

  if (activeProfile.subscription_status !== "active") {
    await admin.auth.admin.deleteUser(userId);
    fail(`Expected subscription_status "active", got "${activeProfile.subscription_status ?? "null"}"`);
  }

  if (activeProfile.stripe_customer_id !== customerId) {
    await admin.auth.admin.deleteUser(userId);
    fail("stripe_customer_id was not updated by webhook");
  }

  if (activeProfile.stripe_subscription_id !== subscriptionId) {
    await admin.auth.admin.deleteUser(userId);
    fail("stripe_subscription_id was not updated by webhook");
  }

  if (activeProfile.subscription_price_id !== proMonthlyPriceId) {
    await admin.auth.admin.deleteUser(userId);
    fail("subscription_price_id was not updated by webhook");
  }

  ok("Profile billing fields updated to active Pro subscription");

  const deleteEvent = buildSubscriptionEvent(
    "customer.subscription.deleted",
    `evt_${randomUUID()}`,
    userId,
    subscriptionId,
    customerId,
    "canceled",
  );
  const deletePayload = JSON.stringify(deleteEvent);

  const deleteResponse = await postSignedWebhook(stripe, deletePayload);
  if (deleteResponse.status !== 200) {
    await admin.auth.admin.deleteUser(userId);
    fail(`Subscription deleted webhook returned ${deleteResponse.status}`);
  }
  ok("Subscription deleted webhook accepted");

  const { data: freeProfile, error: freeProfileError } = await admin
    .from("profiles")
    .select("plan, subscription_status, stripe_subscription_id, cancel_at_period_end")
    .eq("id", userId)
    .single();

  if (freeProfileError || !freeProfile) {
    await admin.auth.admin.deleteUser(userId);
    fail(`Could not read downgraded profile: ${freeProfileError?.message ?? "missing"}`);
  }

  if (freeProfile.plan !== "free") {
    await admin.auth.admin.deleteUser(userId);
    fail(`Expected downgraded plan "free", got "${freeProfile.plan ?? "null"}"`);
  }

  if (freeProfile.subscription_status !== "canceled") {
    await admin.auth.admin.deleteUser(userId);
    fail(`Expected subscription_status "canceled", got "${freeProfile.subscription_status ?? "null"}"`);
  }

  ok("Profile downgraded to free after subscription deletion webhook");

  await admin.from("stripe_webhook_events").delete().eq("id", activateEvent.id);
  await admin.from("stripe_webhook_events").delete().eq("id", deleteEvent.id);
  await admin.auth.admin.deleteUser(userId);
  ok("Temporary test user cleaned up");

  console.log("\n✓ Stripe webhook billing sync verified.\n");
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
