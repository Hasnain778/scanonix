/**
 * Quick registration smoke test using the same public env as the browser client.
 * Run: node --env-file=.env.local scripts/verify-register-flow.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

function fail(message) {
  console.error(`\n✗ Register flow verification failed: ${message}\n`);
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

async function main() {
  if (!url || !key) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL or publishable key");
  }

  const email = `scanonix.register.${randomUUID().slice(0, 8)}@gmail.com`;
  const password = `Test-${randomUUID().slice(0, 12)}!`;
  const fullName = "Register Verify";

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    fail(`signUp failed: ${error.message}`);
  }

  if (data.user?.identities?.length === 0) {
    fail("signUp returned empty identities for new email");
  }

  ok("signUp succeeded for new test email");

  if (data.session) {
    ok("Session returned immediately (email confirmation likely disabled in Supabase)");
  } else {
    ok("Verification email flow expected (no immediate session returned)");
  }

  if (!serviceRoleKey) {
    console.log("\n✓ Register API flow verified (profile check skipped — no service role).\n");
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userId = data.user?.id;
  if (!userId) {
    fail("No user id returned from signUp");
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, plan")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    await admin.auth.admin.deleteUser(userId);
    fail("Profile row was not auto-created after sign-up");
  }

  if (profile.plan !== "free") {
    warn(`Profile plan is "${profile.plan}" (expected "free")`);
  } else {
    ok('Profile auto-created with default plan "free"');
  }

  await admin.auth.admin.deleteUser(userId);
  ok("Test user cleaned up");

  console.log("\n✓ Registration flow verified.\n");
}

function warn(message) {
  console.log(`⚠ ${message}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
