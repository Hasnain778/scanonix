import { NextResponse } from "next/server";
import { env, isStripeConfigured } from "@/config/env";
import { getAuthUser } from "@/lib/auth/session";
import { getStripe } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";

export async function POST() {
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

    const customerId = user.profile?.stripe_customer_id;
    if (!customerId) {
      return NextResponse.json(
        { error: "No billing account found. Subscribe to a plan first." },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.siteUrl}/account/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe portal session error:", error);
    return NextResponse.json(
      { error: "Unable to open billing portal. Please try again." },
      { status: 500 },
    );
  }
}
