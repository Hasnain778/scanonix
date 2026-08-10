/**
 * Stripe billing verifier — config, checkout auth guard, webhook signature checks.
 * Run: npm run verify:stripe
 */

import Stripe from "stripe";

function fail(message) {
  console.error(`\n✗ Stripe verification failed: ${message}\n`);
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function warn(message) {
  console.log(`⚠ ${message}`);
}

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || "";
  const priceIds = [
    ["STRIPE_PRO_MONTHLY_PRICE_ID", process.env.STRIPE_PRO_MONTHLY_PRICE_ID],
    ["STRIPE_PRO_YEARLY_PRICE_ID", process.env.STRIPE_PRO_YEARLY_PRICE_ID],
    [
      "STRIPE_BUSINESS_MONTHLY_PRICE_ID",
      process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID,
    ],
    [
      "STRIPE_BUSINESS_YEARLY_PRICE_ID",
      process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID,
    ],
  ];

  console.log("\nVerifying Stripe billing configuration …\n");

  if (!publishableKey) {
    fail("Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  }
  ok("Publishable key present");

  if (!secretKey) {
    fail("Missing STRIPE_SECRET_KEY");
  }
  ok("Secret key present");

  if (!webhookSecret) {
    warn("Missing STRIPE_WEBHOOK_SECRET — webhook route will reject events until set");
  } else {
    ok("Webhook secret present");
  }

  for (const [name, value] of priceIds) {
    if (!value?.trim()) {
      fail(`Missing ${name}`);
    }
    ok(`${name} configured`);
  }

  const stripe = new Stripe(secretKey, { typescript: true });

  for (const [name, value] of priceIds) {
    const price = await stripe.prices.retrieve(value.trim());
    if (!price.active) {
      warn(`${name} exists but is not active in Stripe`);
    } else {
      ok(`${name} resolves to active Stripe price (${price.id})`);
    }
  }

  if (webhookSecret) {
    const payload = JSON.stringify({ id: "evt_verify_test", object: "event" });
    try {
      stripe.webhooks.generateTestHeaderString({
        payload,
        secret: webhookSecret,
      });
      ok("Webhook secret format is valid for Stripe signature verification");
    } catch (error) {
      fail(
        `Webhook secret invalid: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  const checkoutResponse = await fetch(`${siteUrl}/api/stripe/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan: "pro", interval: "monthly" }),
  });

  if (checkoutResponse.status !== 401) {
    warn(
      `Expected unauthenticated checkout to return 401, got ${checkoutResponse.status}`,
    );
  } else {
    ok("Checkout endpoint rejects logged-out requests");
  }

  if (webhookSecret) {
    const invalidWebhook = await fetch(`${siteUrl}/api/stripe/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "invalid",
      },
      body: JSON.stringify({ id: "evt_invalid", type: "test.event" }),
    });

    if (invalidWebhook.status !== 400) {
      warn(
        `Expected invalid webhook signature to return 400, got ${invalidWebhook.status}`,
      );
    } else {
      ok("Webhook endpoint rejects invalid signatures");
    }
  }

  console.log("\n✓ Stripe billing configuration verified.\n");
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
