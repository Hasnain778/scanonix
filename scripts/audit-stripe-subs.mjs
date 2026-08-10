/** Quick Stripe subscription audit — masks IDs. */
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY?.trim() || "", {
  typescript: true,
});

function mask(id) {
  return id.length <= 8 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`;
}

const { data: profiles } = await import("@supabase/supabase-js").then(({ createClient }) =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  ).from("profiles").select("id, full_name, stripe_customer_id, plan, stripe_subscription_id, subscription_status").not("stripe_customer_id", "is", null).limit(1),
);

const profile = profiles?.[0];
if (!profile) {
  console.log("No profile");
  process.exit(1);
}

console.log("Profile:", profile.full_name, "plan=", profile.plan, "sub=", profile.stripe_subscription_id ? mask(profile.stripe_subscription_id) : "null");

const subs = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: "all", limit: 20 });
for (const s of subs.data) {
  const full = await stripe.subscriptions.retrieve(s.id);
  console.log(JSON.stringify({
    id: mask(full.id),
    status: full.status,
    cancel_at_period_end: full.cancel_at_period_end,
    canceled_at: full.canceled_at ? new Date(full.canceled_at * 1000).toISOString() : null,
    ended_at: full.ended_at ? new Date(full.ended_at * 1000).toISOString() : null,
    created: new Date(full.created * 1000).toISOString(),
  }));
}
