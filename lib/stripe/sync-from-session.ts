import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { syncCheckoutSessionToProfile } from "@/lib/stripe/subscription";

export class CheckoutSessionSyncError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_found"
      | "forbidden"
      | "incomplete"
      | "missing_user"
      | "sync_failed" = "sync_failed",
  ) {
    super(message);
    this.name = "CheckoutSessionSyncError";
  }
}

/** Sync an existing paid Checkout Session to Supabase — no new charges. */
export async function syncExistingCheckoutSession(
  sessionId: string,
  expectedUserId: string,
): Promise<Stripe.Checkout.Session> {
  if (!sessionId.startsWith("cs_")) {
    throw new CheckoutSessionSyncError("Invalid checkout session id.", "not_found");
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  const sessionUserId =
    session.metadata?.supabase_user_id ?? session.client_reference_id ?? null;

  if (!sessionUserId) {
    throw new CheckoutSessionSyncError(
      "Checkout session is not linked to a Supabase user.",
      "missing_user",
    );
  }

  if (sessionUserId !== expectedUserId) {
    throw new CheckoutSessionSyncError(
      "Checkout session belongs to a different account.",
      "forbidden",
    );
  }

  if (session.status !== "complete" || session.payment_status !== "paid") {
    throw new CheckoutSessionSyncError(
      "Checkout session is not complete or paid yet.",
      "incomplete",
    );
  }

  try {
    await syncCheckoutSessionToProfile(session);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not sync subscription.";
    throw new CheckoutSessionSyncError(message, "sync_failed");
  }

  return session;
}
