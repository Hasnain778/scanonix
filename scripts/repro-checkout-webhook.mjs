/**
 * Reproduce webhook processing for the latest completed checkout session.
 * Never prints secrets.
 * Run: node --env-file=.env.local scripts/repro-checkout-webhook.mjs
 */

import Stripe from "stripe";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() || "";

async function main() {
  const stripe = new Stripe(stripeSecretKey, { typescript: true });

  const events = await stripe.events.list({
    type: "checkout.session.completed",
    limit: 1,
  });

  if (!events.data.length) {
    console.error("No checkout.session.completed events found.");
    process.exit(1);
  }

  const event = events.data[0];
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });

  console.log(`Replaying ${event.type} (${event.id}) to ${siteUrl}/api/stripe/webhook …`);

  const response = await fetch(`${siteUrl}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });

  const body = await response.text();
  console.log(`HTTP ${response.status}`);
  console.log(`Response: ${body.slice(0, 500)}`);

  if (response.status !== 200) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
