/**
 * Validates production environment variables.
 * Usage: node scripts/validate-production-env.mjs
 * On Vercel: set env vars then run in CI or locally with production .env
 */

const required = [
  ["NEXT_PUBLIC_SITE_URL", (v) => v && !v.includes("localhost")],
  ["NEXT_PUBLIC_SUPABASE_URL", Boolean],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", Boolean],
  ["SUPABASE_SERVICE_ROLE_KEY", Boolean],
  ["CRON_SECRET", Boolean],
];

const recommended = [
  ["STRIPE_SECRET_KEY", Boolean],
  ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", Boolean],
  ["STRIPE_WEBHOOK_SECRET", Boolean],
  ["STRIPE_PRO_MONTHLY_PRICE_ID", Boolean],
  ["STRIPE_PRO_YEARLY_PRICE_ID", Boolean],
  ["STRIPE_BUSINESS_MONTHLY_PRICE_ID", Boolean],
  ["STRIPE_BUSINESS_YEARLY_PRICE_ID", Boolean],
  ["RUNPOD_API_KEY", Boolean],
  ["RUNPOD_UPSCALE_ENDPOINT_ID", Boolean],
];

let failed = false;

console.log("Scanonix production environment validation\n");

for (const [key, check] of required) {
  const value = process.env[key]?.trim() ?? "";
  if (!check(value)) {
    console.error(`✗ REQUIRED: ${key}`);
    failed = true;
  } else {
    console.log(`✓ ${key}`);
  }
}

for (const [key, check] of recommended) {
  const value = process.env[key]?.trim() ?? "";
  if (!check(value)) {
    console.warn(`⚠ RECOMMENDED: ${key}`);
  } else {
    console.log(`✓ ${key}`);
  }
}

if (failed) {
  console.error("\nValidation failed. Fix required variables before deploying.");
  process.exit(1);
}

console.log("\nRequired production variables are set.");
