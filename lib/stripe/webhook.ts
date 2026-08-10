import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clearProfileSubscription,
  resolveUserIdFromStripeObject,
  syncCheckoutSessionToProfile,
  syncSubscriptionToProfile,
} from "@/lib/stripe/subscription";

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const nestedSubscription = invoice.parent?.subscription_details?.subscription;
  if (nestedSubscription) {
    return typeof nestedSubscription === "string"
      ? nestedSubscription
      : nestedSubscription.id;
  }

  const legacySubscription = (
    invoice as Stripe.Invoice & {
      subscription?: string | { id: string } | null;
    }
  ).subscription;

  if (legacySubscription) {
    return typeof legacySubscription === "string"
      ? legacySubscription
      : legacySubscription.id;
  }

  return null;
}

async function syncInvoiceSubscription(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    return;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscriptionToProfile(subscription);
}

async function hasProcessedEvent(eventId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("stripe_webhook_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();

  return Boolean(data);
}

async function markEventProcessed(event: Stripe.Event): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("stripe_webhook_events").insert({
    id: event.id,
    type: event.type,
  });

  if (error && !error.message.includes("duplicate")) {
    throw new Error(`Failed to record webhook event: ${error.message}`);
  }
}

export async function processStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  if (await hasProcessedEvent(event.id)) {
    return;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await syncCheckoutSessionToProfile(session);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscriptionToProfile(subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id;
      const userId = await resolveUserIdFromStripeObject(
        subscription.metadata,
        customerId,
      );

      if (userId) {
        await clearProfileSubscription(userId);
      }
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      await syncInvoiceSubscription(invoice);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await syncInvoiceSubscription(invoice);
      break;
    }
    default:
      break;
  }

  await markEventProcessed(event);
}
