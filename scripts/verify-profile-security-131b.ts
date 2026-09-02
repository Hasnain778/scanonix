/**
 * Static verification for Phase 131B profiles privileged-field hardening.
 * Run: npx tsx scripts/verify-profile-security-131b.ts
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationPath = "supabase/migrations/014_protect_profile_privileged_fields.sql";
const billingMigrationPath = "supabase/migrations/003_billing.sql";
const profilesMigrationPath = "supabase/migrations/001_profiles.sql";

let passed = 0;
let failed = 0;

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function assert(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`✓ ${name}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function countTriggerCreations(source: string, triggerName: string): number {
  const pattern = new RegExp(
    `create\\s+trigger\\s+${triggerName}\\b`,
    "gi",
  );
  return (source.match(pattern) ?? []).length;
}

function extractFunctionBody(source: string): string {
  const match = source.match(/as \$\$([\s\S]*?)\$\$/i);
  return match?.[1] ?? source;
}

function run() {
  console.log("\nPhase 131B profile security migration verification (static)\n");

  assert("1 migration 014 exists", existsSync(join(root, migrationPath)));

  const migration = read(migrationPath);
  const functionBody = extractFunctionBody(migration);
  const billingMigration = read(billingMigrationPath);
  const profilesMigration = read(profilesMigrationPath);

  assert(
    "2 billing protections remain in function",
    migration.includes("new.plan is distinct from old.plan")
      && migration.includes("new.stripe_customer_id is distinct from old.stripe_customer_id")
      && migration.includes("new.stripe_subscription_id is distinct from old.stripe_subscription_id")
      && migration.includes("new.subscription_status is distinct from old.subscription_status")
      && migration.includes("new.subscription_price_id is distinct from old.subscription_price_id")
      && migration.includes("new.subscription_current_period_end is distinct from old.subscription_current_period_end")
      && migration.includes("new.cancel_at_period_end is distinct from old.cancel_at_period_end"),
  );

  assert(
    "3 role UPDATE protected",
    migration.includes("new.role is distinct from old.role"),
  );

  assert(
    "4 status UPDATE protected",
    migration.includes("new.status is distinct from old.status"),
  );

  assert(
    "5 service_role bypass preserved",
    migration.includes("auth.jwt()->>'role', '') = 'service_role'"),
  );

  assert(
    "6 INSERT role escalation blocked",
    migration.includes("TG_OP = 'INSERT'")
      && migration.includes("coalesce(new.role, 'user') is distinct from 'user'"),
  );

  assert(
    "7 INSERT status manipulation blocked",
    migration.includes("coalesce(new.status, 'active') is distinct from 'active'"),
  );

  assert(
    "8 normal default role permitted on INSERT",
    migration.includes("coalesce(new.role, 'user') is distinct from 'user'"),
  );

  assert(
    "9 normal default status permitted on INSERT",
    migration.includes("coalesce(new.status, 'active') is distinct from 'active'"),
  );

  assert(
    "10 migration 003 unchanged on disk",
    billingMigration.includes("create or replace function public.protect_profile_billing_fields()")
      && billingMigration.includes("before update on public.profiles")
      && !billingMigration.includes("TG_OP = 'INSERT'"),
  );

  assert(
    "11 no RLS policy changes in 014",
    !migration.toLowerCase().includes("create policy")
      && !migration.toLowerCase().includes("drop policy"),
  );

  assert(
    "12 editable profile fields not referenced in protection logic",
    !functionBody.includes("full_name")
      && !functionBody.includes("avatar_url")
      && !functionBody.includes("company_name")
      && !functionBody.includes("job_title")
      && !functionBody.includes("country")
      && !functionBody.includes("time_zone"),
  );

  const updateTriggersIn014 = countTriggerCreations(
    migration,
    "protect_profile_billing_fields",
  );
  assert(
    "13 single protect_profile_billing_fields trigger in 014",
    updateTriggersIn014 === 1,
    `found ${updateTriggersIn014}`,
  );

  assert(
    "13 trigger covers INSERT OR UPDATE without duplicate UPDATE trigger",
    /before\s+insert\s+or\s+update\s+on\s+public\.profiles/i.test(migration),
  );

  const adminQueries = read("lib/admin/queries.ts");
  const stripeSubscription = read("lib/stripe/subscription.ts");
  const stripeReconcile = read("lib/stripe/reconcile.ts");
  const stripeCustomer = read("lib/stripe/customer.ts");
  const supabaseAdmin = read("lib/supabase/admin.ts");

  assert(
    "14 admin status path uses createAdminClient",
    adminQueries.includes("createAdminClient()")
      && adminQueries.includes('.update({ status })'),
  );

  assert(
    "15 Stripe billing path uses createAdminClient",
    stripeSubscription.includes("createAdminClient()")
      && stripeSubscription.includes('.from("profiles").update')
      && stripeReconcile.includes("createAdminClient")
      && stripeCustomer.includes("createAdminClient()"),
  );

  assert(
    "15 service role key used for trusted writes",
    supabaseAdmin.includes("env.supabaseServiceRoleKey"),
  );

  assert(
    "SQL TG_OP handling present",
    migration.includes("TG_OP = 'INSERT'") && migration.includes("TG_OP = 'UPDATE'"),
  );

  const insertBranch = functionBody.split("if TG_OP = 'UPDATE'")[0] ?? "";
  assert(
    "SQL OLD only used on UPDATE branch",
    !insertBranch.includes("old."),
  );

  assert(
    "handle_new_user signup compatible (defaults only, no privileged columns)",
    profilesMigration.includes("insert into public.profiles (id, full_name, avatar_url)"),
  );

  assert(
    "no data mutation statements in 014",
    !/\b(update\s+public\.profiles|delete\s+from\s+public\.profiles|insert\s+into\s+public\.profiles)/i.test(
      migration,
    ),
  );

  const migrationFiles = readdirSync(join(root, "supabase/migrations")).filter((f) =>
    f.endsWith(".sql"),
  );
  assert(
    "014 is next migration after 013",
    migrationFiles.includes("014_protect_profile_privileged_fields.sql")
      && migrationFiles.includes("013_upscale_jobs.sql"),
  );

  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

run();
