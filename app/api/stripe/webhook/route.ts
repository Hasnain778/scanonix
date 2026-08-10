import { NextResponse } from "next/server";
import Stripe from "stripe";
import { isStripeWebhookConfigured } from "@/config/env";
import { getStripe } from "@/lib/stripe/server";
import { processStripeWebhookEvent } from "@/lib/stripe/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isStripeWebhookConfigured()) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? "",
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    await processStripeWebhookEvent(event);
    console.info(`Stripe webhook processed: ${event.type} (${event.id})`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Stripe webhook processing failed (${event.type}):`, error);
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
