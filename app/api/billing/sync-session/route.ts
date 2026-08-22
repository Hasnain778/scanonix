import { NextResponse } from "next/server";
import { extractCheckoutAnalyticsFromSessionMetadata } from "@/lib/analytics/checkout-metadata";
import { getEffectivePlan, hasActiveSubscription } from "@/lib/auth/entitlements";
import { getAuthUser } from "@/lib/auth/session";
import {
  CheckoutSessionSyncError,
  syncExistingCheckoutSession,
} from "@/lib/stripe/sync-from-session";
import { isStripeConfigured } from "@/config/env";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

  let sessionId: string | undefined;
  try {
    const body = (await request.json()) as { sessionId?: string };
    sessionId = body.sessionId?.trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing checkout session id." },
      { status: 400 },
    );
  }

  try {
    const session = await syncExistingCheckoutSession(sessionId, user.id);
    const checkoutAnalytics = extractCheckoutAnalyticsFromSessionMetadata(session.metadata);

    const refreshed = await getAuthUser();
    const profile = refreshed?.profile ?? user.profile;

    return NextResponse.json({
      ok: true,
      plan: getEffectivePlan(profile),
      hasActiveSubscription: hasActiveSubscription(profile),
      billing_interval: checkoutAnalytics.billing_interval,
      source_surface: checkoutAnalytics.source_surface,
      subscriptionPeriodEnd: profile?.subscription_current_period_end ?? null,
    });
  } catch (error) {
    if (error instanceof CheckoutSessionSyncError) {
      const status =
        error.code === "forbidden"
          ? 403
          : error.code === "not_found"
            ? 404
            : error.code === "incomplete"
              ? 409
              : 500;

      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    console.error("Checkout session sync error:", error);
    return NextResponse.json(
      { error: "Could not sync subscription from checkout session." },
      { status: 500 },
    );
  }
}
