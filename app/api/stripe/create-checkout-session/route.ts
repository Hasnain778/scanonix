import { NextResponse } from "next/server";
import { env, isStripeConfigured } from "@/config/env";
import {
  billingIntervalToAnalytics,
  parseCheckoutSourceSurface,
} from "@/lib/analytics/checkout-metadata";
import { getAuthUser } from "@/lib/auth/session";
import { getOrCreateStripeCustomer } from "@/lib/stripe/customer";
import {
  getStripePriceId,
  isApprovedCheckoutPlan,
} from "@/lib/stripe/plans";
import { getStripe } from "@/lib/stripe/server";
import { hasActiveSubscription } from "@/lib/auth/entitlements";
import type { CheckoutPlanRequest } from "@/types/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Stripe billing is not configured." },
        { status: 503 },
      );
    }

    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = (await request.json()) as CheckoutPlanRequest;
    const { plan, interval } = body;
    const sourceSurface = parseCheckoutSourceSurface(body.source_surface);
    const billingIntervalAnalytics = billingIntervalToAnalytics(interval);

    if (!isApprovedCheckoutPlan(plan, interval)) {
      return NextResponse.json(
        { error: "Invalid plan or billing interval." },
        { status: 400 },
      );
    }

    const profile = user.profile;

    if (profile && hasActiveSubscription(profile)) {
      return NextResponse.json(
        {
          error:
            "You already have an active subscription. Use Manage Subscription in billing to change or cancel your plan.",
        },
        { status: 409 },
      );
    }

    const priceId = getStripePriceId(plan, interval);
    const customerId = await getOrCreateStripeCustomer(
      user.id,
      user.email,
      profile,
    );

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.siteUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.siteUrl}/pricing?checkout=cancelled`,
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
        plan,
        interval,
        billing_interval: billingIntervalAnalytics,
        source_surface: sourceSurface,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan,
          interval,
          billing_interval: billingIntervalAnalytics,
          source_surface: sourceSurface,
        },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Could not create checkout session." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout session error:", error);
    return NextResponse.json(
      { error: "Unable to start checkout. Please try again." },
      { status: 500 },
    );
  }
}
