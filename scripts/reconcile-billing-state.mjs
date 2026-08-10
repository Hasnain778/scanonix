/**
 * Reconcile Supabase billing fields with Stripe subscriptions for a customer.
 * Read-only against Stripe except profile updates — no new subscriptions/charges.
 * Run: node --env-file=.env.local scripts/reconcile-billing-state.mjs
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() || "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

const ACTIVE = new Set(["active", "trialing"]);

function mask(id) {
  return id.length <= 8 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function bucket(sub) {
  if (sub.status === "canceled") return "cancelled";
  if (!ACTIVE.has(sub.status)) return "other";
  return sub.cancel_at_period_end ? "cancel_at_period_end" : "active";
}

function pickAuthoritative(subs) {
  const usable = subs.filter((s) => ACTIVE.has(s.status));
  if (!usable.length) return null;
  usable.sort((a, b) => {
    if (a.cancel_at_period_end !== b.cancel_at_period_end) {
      return a.cancel_at_period_end ? 1 : -1;
    }
    return b.created - a.created;
  });
  return usable[0];
}

async function main() {
  const stripe = new Stripe(stripeSecretKey, { typescript: true });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profiles, error } = await admin
    .from("profiles")
    .select(
      "id, full_name, plan, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_price_id, subscription_current_period_end, cancel_at_period_end",
    )
    .not("stripe_customer_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(5);

  if (error || !profiles?.length) {
    console.error("No billed profiles found.");
    process.exit(1);
  }

  const profile = profiles[0];
  const customerId = profile.stripe_customer_id;

  console.log("\n=== Stripe subscriptions ===\n");
  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  for (const sub of listed.data) {
    console.log(
      `- ${mask(sub.id)} status=${sub.status} bucket=${bucket(sub)} cancel_at_period_end=${sub.cancel_at_period_end}`,
    );
  }

  const authoritative = pickAuthoritative(listed.data);
  console.log(
    `\nAuthoritative subscription: ${authoritative ? mask(authoritative.id) : "none"}`,
  );

  if (profile.stripe_subscription_id && authoritative) {
    const profilePointsToCancelled = !listed.data.some(
      (sub) =>
        sub.id === profile.stripe_subscription_id &&
        ACTIVE.has(sub.status),
    );
    if (profilePointsToCancelled) {
      console.log(
        `⚠ Profile referenced ${mask(profile.stripe_subscription_id)} which is no longer usable.`,
      );
    }
  }

  console.log("\n=== Reconciling Supabase profile ===\n");

  if (!authoritative) {
    await admin
      .from("profiles")
      .update({
        plan: "free",
        stripe_subscription_id: null,
        subscription_status: "canceled",
        subscription_price_id: null,
        subscription_current_period_end: null,
        cancel_at_period_end: false,
      })
      .eq("id", profile.id);
  } else {
    const priceId = authoritative.items.data[0]?.price?.id ?? null;
    const periodEndUnix = authoritative.items.data[0]?.current_period_end ?? null;
    const plan =
      priceId &&
      (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID ||
        priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID)
        ? "pro"
        : priceId &&
            (priceId === process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID ||
              priceId === process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID)
          ? "business"
          : "free";

    await admin
      .from("profiles")
      .update({
        plan: ACTIVE.has(authoritative.status) ? plan : "free",
        stripe_customer_id: customerId,
        stripe_subscription_id: authoritative.id,
        subscription_status: authoritative.status,
        subscription_price_id: priceId,
        subscription_current_period_end: periodEndUnix
          ? new Date(periodEndUnix * 1000).toISOString()
          : null,
        cancel_at_period_end: authoritative.cancel_at_period_end,
      })
      .eq("id", profile.id);
  }

  const { data: synced } = await admin
    .from("profiles")
    .select(
      "plan, stripe_subscription_id, subscription_status, subscription_price_id, cancel_at_period_end",
    )
    .eq("id", profile.id)
    .single();

  console.log("Final Supabase profile:");
  console.log(`  plan: ${synced?.plan}`);
  console.log(`  subscription_status: ${synced?.subscription_status ?? "null"}`);
  console.log(
    `  stripe_subscription_id: ${synced?.stripe_subscription_id ? mask(synced.stripe_subscription_id) : "null"}`,
  );
  console.log(`  cancel_at_period_end: ${synced?.cancel_at_period_end}`);

  console.log("\n=== API checks ===\n");

  const billingStatusProbe = await fetch(`${siteUrl}/api/billing/status`);
  console.log(`GET /api/billing/status (unauthenticated): HTTP ${billingStatusProbe.status}`);

  const portalProbe = await fetch(`${siteUrl}/api/stripe/create-portal-session`, {
    method: "POST",
  });
  console.log(
    `POST /api/stripe/create-portal-session (unauthenticated): HTTP ${portalProbe.status}`,
  );

  const checkoutProbe = await fetch(`${siteUrl}/api/stripe/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan: "pro", interval: "monthly" }),
  });
  console.log(
    `POST /api/stripe/create-checkout-session (unauthenticated): HTTP ${checkoutProbe.status}`,
  );

  console.log("\nDone.\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
