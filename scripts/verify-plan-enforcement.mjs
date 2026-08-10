/**
 * Plan enforcement verification — auth, plan gates, usage limits, race safety.
 * Run: npm run verify:plan-enforcement
 *
 * Requires: .env.local with Supabase keys, SUPABASE_SERVICE_ROLE_KEY,
 * and a running Next.js dev server at NEXT_PUBLIC_SITE_URL (default http://localhost:3000).
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  "";
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

function fail(message) {
  console.error(`\n✗ Plan enforcement verification failed: ${message}\n`);
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function authCookie(session) {
  const projectRef = new URL(url).hostname.split(".")[0];
  return `sb-${projectRef}-auth-token=${encodeURIComponent(JSON.stringify(session))}`;
}

async function apiFetch(path, { session, method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (session) {
    headers.Cookie = authCookie(session);
  }

  const response = await fetch(`${siteUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return { response, json };
}

async function createVerifiedUser(admin, label) {
  const email = `${label}-${randomUUID().slice(0, 8)}@scanonix.test`;
  const password = `Test-${randomUUID().slice(0, 12)}!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Plan Verify ${label}` },
  });

  if (error || !data.user) {
    fail(`Could not create ${label} user: ${error?.message ?? "unknown"}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 1200));
  return { userId: data.user.id, email, password };
}

async function signIn(email, password) {
  const anon = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    fail(`Could not sign in ${email}: ${error?.message ?? "no session"}`);
  }

  return data.session;
}

async function setPlan(admin, userId, plan) {
  const { error } = await admin
    .from("profiles")
    .update({
      plan,
      subscription_status: plan === "free" ? "canceled" : "active",
      stripe_subscription_id: plan === "free" ? null : `sub_test_${randomUUID().slice(0, 8)}`,
    })
    .eq("id", userId);

  if (error) {
    fail(`Could not set plan ${plan}: ${error.message}`);
  }
}

async function resetUsage(admin, userId) {
  await admin.from("usage_counters").delete().eq("user_id", userId);
}

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

  const email = `plan-verify-rpc-${randomUUID().slice(0, 8)}@scanonix.test`;
  const password = `Test-${randomUUID().slice(0, 12)}!`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Plan RPC Verify Temp" },
  });

  if (createError || !created.user?.id) {
    fail(
      `No auth users exist and could not create temporary user: ${createError?.message ?? "unknown"}`,
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 1200));
  return { userId: created.user.id, temporary: true };
}

async function verifyMigration(admin) {
  const { error: tableError } = await admin
    .from("usage_counters")
    .select("id")
    .limit(1);

  if (tableError) {
    fail(
      `usage_counters table missing — run supabase/migrations/004_usage_tracking.sql (${tableError.message})`,
    );
  }
  ok("usage_counters table exists");

  const { userId, temporary } = await resolveAuthUserIdForRpcTest(admin);
  const periodStart = startOfUtcDay(new Date()).toISOString();
  const periodEnd = addUtcDays(startOfUtcDay(new Date()), 1).toISOString();
  const testAction = `plan_verify_rpc_${randomUUID().slice(0, 8)}`;

  const { data, error } = await admin.rpc("consume_tool_usage", {
    p_user_id: userId,
    p_action: testAction,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_limit: 2,
  });

  if (error) {
    if (temporary) {
      await admin.auth.admin.deleteUser(userId);
    }
    fail(`consume_tool_usage RPC missing or failed: ${error.message}`);
  }

  if (!data?.allowed || data.usage_count !== 1) {
    await admin
      .from("usage_counters")
      .delete()
      .eq("user_id", userId)
      .eq("action", testAction);
    if (temporary) {
      await admin.auth.admin.deleteUser(userId);
    }
    fail("consume_tool_usage RPC returned unexpected first increment result");
  }
  ok("consume_tool_usage RPC works via service role");

  await admin
    .from("usage_counters")
    .delete()
    .eq("user_id", userId)
    .eq("action", testAction)
    .eq("period_start", periodStart);

  if (temporary) {
    await admin.auth.admin.deleteUser(userId);
  }
}

async function verifyUnauthenticated() {
  const endpoints = [
    { path: "/api/usage/consume", method: "POST", body: { tool: "test" } },
    { path: "/api/usage/summary", method: "GET" },
    { path: "/api/ai/summary", method: "POST", body: { text: "hello" } },
    {
      path: "/api/tools/background-remover/authorize-export",
      method: "POST",
      body: { resolution: "4k" },
    },
  ];

  for (const endpoint of endpoints) {
    const { response } = await apiFetch(endpoint.path, {
      method: endpoint.method,
      body: endpoint.body,
    });

    if (response.status !== 401) {
      fail(`${endpoint.path} without auth returned ${response.status}, expected 401`);
    }
  }

  ok("Unauthenticated API requests return 401");
}

async function verifyFreeRestrictions(freeSession) {
  const ai = await apiFetch("/api/ai/summary", {
    session: freeSession,
    method: "POST",
    body: { text: "Summarize this paragraph about testing plan enforcement." },
  });

  if (ai.response.status !== 403) {
    fail(`Free user AI summary returned ${ai.response.status}, expected 403`);
  }
  ok("Free user cannot access premium AI routes");

  const export4k = await apiFetch("/api/tools/background-remover/authorize-export", {
    session: freeSession,
    method: "POST",
    body: { resolution: "4k" },
  });

  if (export4k.response.status !== 403) {
    fail(`Free user 4K export returned ${export4k.response.status}, expected 403`);
  }
  ok("Free user cannot authorize 4K export");

  const exportHd = await apiFetch("/api/tools/background-remover/authorize-export", {
    session: freeSession,
    method: "POST",
    body: { resolution: "hd" },
  });

  if (exportHd.response.status !== 200 || exportHd.json?.allowedResolution !== "hd") {
    fail("Free user HD export authorization failed");
  }
  ok("Free user can authorize HD export");
}

async function verifyPro4K(proSession) {
  const export4k = await apiFetch("/api/tools/background-remover/authorize-export", {
    session: proSession,
    method: "POST",
    body: { resolution: "4k" },
  });

  if (export4k.response.status !== 200 || export4k.json?.allowedResolution !== "4k") {
    fail(`Pro user 4K export returned ${export4k.response.status}, expected 200 with 4k`);
  }
  ok("Pro user can authorize 4K export");
}

async function verifyFakePlanIgnored(freeSession, admin, freeUserId) {
  await setPlan(admin, freeUserId, "business");

  const summary = await apiFetch("/api/usage/summary", { session: freeSession });
  if (summary.response.status !== 200) {
    fail(`Usage summary failed after profile tamper: ${summary.response.status}`);
  }

  if (summary.json?.plan !== "business") {
    fail("Server did not load updated plan from profile after admin change");
  }

  await setPlan(admin, freeUserId, "free");

  const consume = await apiFetch("/api/usage/consume", {
    session: freeSession,
    method: "POST",
    body: { tool: "test", plan: "business" },
  });

  if (consume.response.status !== 200) {
    fail(`Consume with fake client plan body failed unexpectedly: ${consume.response.status}`);
  }

  if (consume.json?.limit !== 10) {
    fail(`Client-supplied fake plan was trusted (limit=${consume.json?.limit}, expected 10 for free)`);
  }
  ok("Client-supplied fake plan is ignored — server uses profile plan");
}

async function verifyParallelLimit(admin, freeUserId, freeSession) {
  await resetUsage(admin, freeUserId);

  const attempts = 15;
  const results = await Promise.all(
    Array.from({ length: attempts }, () =>
      apiFetch("/api/usage/consume", {
        session: freeSession,
        method: "POST",
        body: { tool: "parallel-test" },
      }),
    ),
  );

  const allowed = results.filter((item) => item.response.status === 200).length;
  const blocked = results.filter((item) => item.response.status === 429).length;

  if (allowed !== 10) {
    fail(`Parallel consume allowed ${allowed}/15, expected exactly 10 for free daily limit`);
  }

  if (blocked !== 5) {
    fail(`Parallel consume blocked ${blocked}/15, expected 5 rejections at limit`);
  }
  ok("Parallel requests cannot bypass free daily limit (10 allowed, 5 rejected)");
}

async function verifyBusinessLimit(admin, businessUserId, businessSession) {
  await resetUsage(admin, businessUserId);

  const summary = await apiFetch("/api/usage/summary", { session: businessSession });
  if (summary.response.status !== 200) {
    fail(`Business usage summary failed: ${summary.response.status}`);
  }

  if (summary.json?.plan !== "business" || summary.json?.limit !== 2500) {
    fail(
      `Business plan limit incorrect (plan=${summary.json?.plan}, limit=${summary.json?.limit})`,
    );
  }
  ok("Business user receives 2500 monthly operation limit");
}

async function main() {
  if (!url || !publishableKey || !serviceRoleKey) {
    fail("Missing Supabase URL, publishable key, or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  console.log(`\nVerifying plan enforcement (${siteUrl}) …\n`);

  const health = await fetch(`${siteUrl}/api/health/supabase`);
  if (!health.ok) {
    fail(
      `Next.js server not reachable at ${siteUrl} — start with npm run dev before running this script`,
    );
  }
  ok("Next.js server reachable");

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await verifyMigration(admin);
  await verifyUnauthenticated();

  const freeUser = await createVerifiedUser(admin, "free");
  const proUser = await createVerifiedUser(admin, "pro");
  const businessUser = await createVerifiedUser(admin, "business");

  await setPlan(admin, freeUser.userId, "free");
  await setPlan(admin, proUser.userId, "pro");
  await setPlan(admin, businessUser.userId, "business");

  const freeSession = await signIn(freeUser.email, freeUser.password);
  const proSession = await signIn(proUser.email, proUser.password);
  const businessSession = await signIn(businessUser.email, businessUser.password);

  await verifyFreeRestrictions(freeSession);
  await verifyPro4K(proSession);
  await verifyFakePlanIgnored(freeSession, admin, freeUser.userId);
  await verifyParallelLimit(admin, freeUser.userId, freeSession);
  await verifyBusinessLimit(admin, businessUser.userId, businessSession);

  await admin.auth.admin.deleteUser(freeUser.userId);
  await admin.auth.admin.deleteUser(proUser.userId);
  await admin.auth.admin.deleteUser(businessUser.userId);
  ok("Temporary test users cleaned up");

  console.log("\n✓ Plan enforcement verification passed.\n");
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
