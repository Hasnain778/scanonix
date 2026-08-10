/**
 * Safe env presence check — never prints secret values.
 * Run: node --env-file=.env.local scripts/check-stripe-env.mjs
 */

const STRIPE_VARS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_MONTHLY_PRICE_ID",
  "STRIPE_PRO_YEARLY_PRICE_ID",
  "STRIPE_BUSINESS_MONTHLY_PRICE_ID",
  "STRIPE_BUSINESS_YEARLY_PRICE_ID",
];

const RELATED_VARS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

function status(key) {
  const value = process.env[key]?.trim() ?? "";
  if (!value) {
    return { key, state: "missing" };
  }

  if (key.includes("PRICE_ID")) {
    return { key, state: "set", hint: value.startsWith("price_") ? value : "unexpected format" };
  }

  if (key === "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") {
    return {
      key,
      state: "set",
      hint: value.startsWith("pk_") ? "pk_*" : "unexpected format",
    };
  }

  if (key === "STRIPE_SECRET_KEY") {
    return {
      key,
      state: "set",
      hint: value.startsWith("sk_") ? "sk_*" : "unexpected format",
    };
  }

  if (key === "STRIPE_WEBHOOK_SECRET") {
    return {
      key,
      state: "set",
      hint: value.startsWith("whsec_") ? "whsec_*" : "unexpected format",
    };
  }

  return { key, state: "set" };
}

console.log("\nStripe environment check\n");

for (const key of STRIPE_VARS) {
  const result = status(key);
  if (result.state === "missing") {
    console.log(`✗ ${key} — missing`);
  } else {
    console.log(`✓ ${key} — loaded${result.hint ? ` (${result.hint})` : ""}`);
  }
}

console.log("\nRelated billing dependencies\n");
for (const key of RELATED_VARS) {
  const value = process.env[key]?.trim() ?? "";
  console.log(`${value ? "✓" : "✗"} ${key} — ${value ? "loaded" : "missing"}`);
}

console.log("");
