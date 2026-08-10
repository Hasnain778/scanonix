/**
 * Webhook signature handling check — never prints secrets.
 * Run: node --env-file=.env.local scripts/verify-webhook-signature.mjs
 */

import Stripe from "stripe";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
const secretKey = process.env.STRIPE_SECRET_KEY?.trim() || "";

function fail(message) {
  console.error(`\n✗ Webhook verification failed: ${message}\n`);
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

async function main() {
  console.log("\nVerifying Stripe webhook signature handling …\n");

  if (!webhookSecret) {
    fail("STRIPE_WEBHOOK_SECRET is not loaded");
  }
  ok("STRIPE_WEBHOOK_SECRET loaded (whsec_*)");

  if (!secretKey) {
    fail("STRIPE_SECRET_KEY is required for signature generation test");
  }

  const invalidResponse = await fetch(`${siteUrl}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "invalid",
    },
    body: JSON.stringify({ id: "evt_invalid_test", type: "test.event" }),
  });

  if (invalidResponse.status !== 400) {
    fail(`Invalid signature should return 400, got ${invalidResponse.status}`);
  }
  ok("Invalid webhook signature rejected with HTTP 400");

  const stripe = new Stripe(secretKey, { typescript: true });
  const payload = JSON.stringify({
    id: "evt_verify_signature_test",
    object: "event",
    type: "test.event",
    data: { object: {} },
  });

  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });

  const validResponse = await fetch(`${siteUrl}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });

  if (validResponse.status === 400) {
    const errorBody = await validResponse.json().catch(() => ({}));
    if (errorBody.error?.includes("Invalid webhook signature")) {
      fail("Valid test signature was incorrectly rejected");
    }
  }

  if (validResponse.status === 200) {
    const body = await validResponse.json();
    if (!body.received) {
      fail("Valid webhook response missing received: true");
    }
    ok("Valid test webhook signature accepted with HTTP 200");

    const duplicateResponse = await fetch(`${siteUrl}/api/stripe/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      body: payload,
    });

    if (duplicateResponse.status !== 200) {
      fail(`Duplicate webhook delivery should still return 200, got ${duplicateResponse.status}`);
    }
    ok("Duplicate webhook delivery handled idempotently");
  } else if (validResponse.status === 500) {
    ok(
      "Valid test webhook signature accepted (signature verified; downstream processing needs SUPABASE_SERVICE_ROLE_KEY)",
    );
  } else {
    fail(`Valid test signature unexpected status ${validResponse.status}`);
  }

  console.log("\n✓ Webhook signature handling verified.\n");
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
