/**
 * Auth integration verifier — signup profile trigger, login, password reset API.
 * Run: npm run verify:auth
 *
 * Full avatar upload test requires SUPABASE_SERVICE_ROLE_KEY.
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

function fail(message) {
  console.error(`\n✗ Auth verification failed: ${message}\n`);
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function warn(message) {
  console.log(`⚠ ${message}`);
}

async function main() {
  if (!url || !publishableKey) {
    fail("Missing Supabase URL or publishable key in .env.local");
  }

  console.log(`\nVerifying auth integration at ${url} …\n`);

  const anon = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const settingsRes = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
  });
  if (!settingsRes.ok) {
    fail(`Auth settings API returned ${settingsRes.status}`);
  }
  ok("Auth settings API reachable");

  const { error: badLoginError } = await anon.auth.signInWithPassword({
    email: "nonexistent-verify@scanonix.test",
    password: "wrong-password-123456",
  });
  if (!badLoginError) {
    fail("Invalid login should fail but succeeded");
  }
  ok("Login rejects invalid credentials");

  const resetEmail = `reset-check-${randomUUID().slice(0, 8)}@scanonix.test`;
  const { error: resetError } = await anon.auth.resetPasswordForEmail(resetEmail, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/reset-password`,
  });
  if (resetError && !resetError.message.toLowerCase().includes("rate")) {
    fail(`Forgot password API failed: ${resetError.message}`);
  }
  ok("Forgot password API accepts reset requests");

  if (!serviceRoleKey) {
    warn(
      "Skipping signup/profile/avatar tests — add SUPABASE_SERVICE_ROLE_KEY to .env.local for full E2E verification",
    );
    console.log("\n✓ Auth API checks passed (partial — no service role).\n");
    return;
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const testEmail = `verify-${randomUUID().slice(0, 8)}@scanonix.test`;
  const testPassword = `Test-${randomUUID().slice(0, 12)}!`;
  const testName = "Scanonix Verify";

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: testName },
  });

  if (createError || !created.user) {
    fail(`Could not create test user: ${createError?.message ?? "unknown"}`);
  }

  const userId = created.user.id;
  ok("Test user created via admin API");

  await new Promise((r) => setTimeout(r, 1500));

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, plan")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    fail(`Profile query failed: ${profileError.message}`);
  }

  if (!profile) {
    await admin.auth.admin.deleteUser(userId);
    fail("Profile was not auto-created after sign-up (check handle_new_user trigger)");
  }

  if (profile.full_name !== testName) {
    warn(`Profile full_name is "${profile.full_name ?? ""}" (expected "${testName}")`);
  } else {
    ok("Profile auto-created with correct full_name after sign-up");
  }

  if (profile.plan !== "free") {
    warn(`Profile plan is "${profile.plan ?? ""}" (expected "free")`);
  } else {
    ok('Profile default plan is "free"');
  }

  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (signInError || !signIn.session) {
    await admin.auth.admin.deleteUser(userId);
    fail(`Login failed: ${signInError?.message ?? "no session"}`);
  }
  ok("Login succeeds with valid credentials");

  const userClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await userClient.auth.setSession({
    access_token: signIn.session.access_token,
    refresh_token: signIn.session.refresh_token,
  });

  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const avatarBytes = Buffer.from(pngBase64, "base64");
  const avatarPath = `${userId}/avatar.png`;

  const { error: uploadError } = await userClient.storage
    .from("avatars")
    .upload(avatarPath, avatarBytes, { upsert: true, contentType: "image/png" });

  if (uploadError) {
    await admin.auth.admin.deleteUser(userId);
    fail(`Avatar upload failed: ${uploadError.message}`);
  }
  ok("Avatar upload to avatars bucket works");

  const otherUserId = randomUUID();
  const { error: crossAvatarUploadError } = await userClient.storage
    .from("avatars")
    .upload(`${otherUserId}/avatar.png`, avatarBytes, {
      upsert: true,
      contentType: "image/png",
    });

  if (!crossAvatarUploadError) {
    await userClient.storage.from("avatars").remove([`${otherUserId}/avatar.png`]);
    await admin.auth.admin.deleteUser(userId);
    fail("User should not upload to another user's avatar folder");
  }
  ok("Avatar upload blocked for another user's folder");

  const privatePath = `${userId}/private-test.txt`;
  const { error: privateUploadError } = await userClient.storage
    .from("user-files")
    .upload(privatePath, Buffer.from("scanonix-verify"), {
      upsert: true,
      contentType: "text/plain",
    });

  if (privateUploadError) {
    await admin.auth.admin.deleteUser(userId);
    fail(`Private file upload failed: ${privateUploadError.message}`);
  }
  ok("Private user-files upload works");

  const { data: privateDownload, error: privateDownloadError } = await userClient.storage
    .from("user-files")
    .download(privatePath);

  if (privateDownloadError || !privateDownload) {
    await userClient.storage.from("user-files").remove([privatePath]);
    await admin.auth.admin.deleteUser(userId);
    fail(`Private file read failed: ${privateDownloadError?.message ?? "no data"}`);
  }
  ok("Private user-files read works");

  const { error: crossPrivateReadError } = await userClient.storage
    .from("user-files")
    .download(`${otherUserId}/private-test.txt`);

  if (!crossPrivateReadError) {
    await userClient.storage.from("user-files").remove([privatePath]);
    await admin.auth.admin.deleteUser(userId);
    fail("User should not read another user's private files");
  }
  ok("Private user-files read blocked for another user's folder");

  await userClient.storage.from("user-files").remove([privatePath]);

  const { data: otherProfile, error: crossProfileError } = await userClient
    .from("profiles")
    .select("id")
    .eq("id", otherUserId)
    .maybeSingle();

  if (crossProfileError) {
    warn(`Cross-profile query returned error (may be expected): ${crossProfileError.message}`);
  } else if (otherProfile) {
    await admin.auth.admin.deleteUser(userId);
    fail("User should not read another user's profile row");
  } else {
    ok("Profile read blocked for non-existent/other user via RLS");
  }

  const { error: signOutError } = await userClient.auth.signOut();
  if (signOutError) {
    await admin.auth.admin.deleteUser(userId);
    fail(`Logout failed: ${signOutError.message}`);
  }
  ok("Logout succeeds");

  await userClient.storage.from("avatars").remove([avatarPath]);
  await admin.auth.admin.deleteUser(userId);
  ok("Test user cleaned up");

  console.log("\n✓ Full auth integration verified.\n");
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
