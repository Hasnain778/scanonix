/**
 * Strict post-migration verifier for profiles + avatars + RLS.
 * Run: npm run verify:migration
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { verifyStorageBuckets } from "./lib/verify-storage.mjs";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  "";
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.SUPABASE_ANON_KEY?.trim() ||
  "";

function fail(message) {
  console.error(`\n✗ Migration verification failed: ${message}\n`);
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function warn(message) {
  console.log(`⚠ ${message}`);
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Resolve a real auth.users id for RPC verification — never use a fake UUID. */
async function resolveAuthUserIdForRpcTest(admin) {
  const { data: listData, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });

  if (listError) {
    fail(`Could not list auth users for RPC test: ${listError.message}`);
  }

  const existingUser = listData?.users?.[0];
  if (existingUser?.id) {
    return { userId: existingUser.id, temporary: false };
  }

  const email = `migration-verify-${randomUUID().slice(0, 8)}@scanonix.test`;
  const password = `Test-${randomUUID().slice(0, 12)}!`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Migration Verify Temp" },
  });

  if (createError || !created.user?.id) {
    fail(
      `No auth users exist and could not create temporary user: ${createError?.message ?? "unknown"}`,
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 1200));
  ok("Temporary auth user created for usage RPC verification");

  return { userId: created.user.id, temporary: true };
}

async function verifyConsumeToolUsageRpc(admin) {
  const { userId, temporary } = await resolveAuthUserIdForRpcTest(admin);

  const periodStart = startOfUtcDay().toISOString();
  const periodEnd = addUtcDays(startOfUtcDay(), 1).toISOString();
  const testAction = `migration_verify_${randomUUID().slice(0, 8)}`;

  const { data, error } = await admin.rpc("consume_tool_usage", {
    p_user_id: userId,
    p_action: testAction,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_limit: 1,
  });

  if (error) {
    if (temporary) {
      await admin.auth.admin.deleteUser(userId);
    }
    fail(`consume_tool_usage RPC check failed: ${error.message}`);
  }

  if (!data?.allowed || data.usage_count !== 1) {
    await admin.from("usage_counters").delete().eq("user_id", userId).eq("action", testAction);
    if (temporary) {
      await admin.auth.admin.deleteUser(userId);
    }
    fail("consume_tool_usage RPC returned unexpected first increment result");
  }

  ok("consume_tool_usage RPC works via service role");

  const { error: cleanupError } = await admin
    .from("usage_counters")
    .delete()
    .eq("user_id", userId)
    .eq("action", testAction)
    .eq("period_start", periodStart);

  if (cleanupError) {
    warn(`Could not delete verification usage row: ${cleanupError.message}`);
  } else {
    ok("Verification usage row cleaned up");
  }

  if (temporary) {
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      warn(`Could not delete temporary auth user: ${deleteUserError.message}`);
    } else {
      ok("Temporary auth user deleted");
    }
  }
}

async function main() {
  if (!url || !publishableKey) {
    fail(
      "Missing credentials. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local",
    );
  }

  console.log(`\nVerifying Supabase migration at ${url} …\n`);

  const headers = {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
  };

  const authRes = await fetch(`${url}/auth/v1/settings`, { headers });
  if (!authRes.ok) {
    fail(`Auth API returned ${authRes.status} ${authRes.statusText}`);
  }
  ok("Auth API reachable");

  const profilesRes = await fetch(
    `${url}/rest/v1/profiles?select=id,full_name,avatar_url,plan,created_at,updated_at&limit=1`,
    { headers: { ...headers, Accept: "application/json" } },
  );

  if (profilesRes.status === 404 || profilesRes.status === 406) {
    fail(
      "profiles table not found — paste and run supabase/migrations/001_profiles.sql in the Supabase SQL Editor",
    );
  }

  if (!profilesRes.ok) {
    const body = await profilesRes.text();
    if (body.includes("does not exist") || body.includes("schema cache")) {
      fail(
        "profiles table not found — paste and run supabase/migrations/001_profiles.sql in the Supabase SQL Editor",
      );
    }
    fail(`profiles query failed (${profilesRes.status}): ${body.slice(0, 200)}`);
  }

  const profiles = await profilesRes.json();
  if (!Array.isArray(profiles)) {
    fail("profiles query returned unexpected response");
  }
  ok("profiles table exists and is queryable");

  const anonProfilesRes = await fetch(`${url}/rest/v1/profiles?select=id&limit=5`, {
    headers: { ...headers, Accept: "application/json" },
  });
  if (!anonProfilesRes.ok) {
    fail(`RLS check failed — anonymous profiles read returned ${anonProfilesRes.status}`);
  }
  const anonProfiles = await anonProfilesRes.json();
  if (!Array.isArray(anonProfiles)) {
    fail("RLS check failed — expected array response for anonymous profiles read");
  }
  if (anonProfiles.length > 0) {
    fail("RLS check failed — anonymous client can read profile rows (policies too permissive)");
  }
  ok("RLS active — anonymous clients cannot read other users' profiles");

  const { avatars, userFiles } = await verifyStorageBuckets(url, publishableKey);

  if (!avatars.exists) {
    fail(`avatars bucket not found (${avatars.detail})`);
  }
  ok(`avatars storage bucket exists (${avatars.detail})`);

  if (userFiles.exists) {
    ok(`user-files storage bucket exists (${userFiles.detail})`);
  } else {
    console.log(`⚠ user-files bucket not detected (${userFiles.detail})`);
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (serviceRoleKey) {
    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: usageTableError } = await admin
      .from("usage_counters")
      .select("id")
      .limit(1);

    if (usageTableError) {
      const message = usageTableError.message ?? "";
      if (
        message.includes("does not exist") ||
        message.includes("schema cache") ||
        usageTableError.code === "42P01"
      ) {
        fail(
          "usage_counters table not found — paste and run supabase/migrations/004_usage_tracking.sql in the Supabase SQL Editor",
        );
      }
      fail(`usage_counters query failed: ${message}`);
    }
    ok("usage_counters table exists");

    await verifyConsumeToolUsageRpc(admin);
  } else {
    console.log("⚠ Skipping usage_counters/RPC checks — add SUPABASE_SERVICE_ROLE_KEY for full verification");
  }

  console.log("\n✓ Migration verified — profiles table, avatars bucket, and RLS checks passed.\n");
  console.log("Next: test sign-up at http://localhost:3000/register\n");
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
