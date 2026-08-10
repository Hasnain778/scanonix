/**
 * Standalone Supabase connection verifier.
 * Run: npm run verify:supabase
 */

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
  console.error(`\n✗ Supabase connection failed: ${message}\n`);
  process.exit(1);
}

async function main() {
  if (!url || !publishableKey) {
    fail(
      "Missing credentials. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local",
    );
  }

  console.log(`\nChecking Supabase at ${url} …\n`);

  const headers = {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
  };

  const authRes = await fetch(`${url}/auth/v1/settings`, { headers });
  if (!authRes.ok) {
    fail(`Auth API returned ${authRes.status} ${authRes.statusText}`);
  }
  console.log("✓ Auth API reachable");

  const dbRes = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
    headers: { ...headers, Accept: "application/json" },
  });

  if (dbRes.status === 404 || dbRes.status === 406) {
    console.log("⚠ Database reachable but profiles table may be missing — run 001_profiles.sql");
  } else if (!dbRes.ok) {
    const body = await dbRes.text();
    fail(`Database API returned ${dbRes.status}: ${body.slice(0, 200)}`);
  } else {
    console.log("✓ Database reachable (profiles table OK)");
  }

  const { avatars, userFiles } = await verifyStorageBuckets(url, publishableKey);
  console.log("✓ Storage API reachable");
  if (avatars.exists) {
    console.log(`✓ avatars bucket found (${avatars.detail})`);
  } else {
    console.log(`⚠ avatars bucket not found (${avatars.detail})`);
  }

  if (userFiles.exists) {
    console.log(`✓ user-files bucket found (${userFiles.detail})`);
  }

  console.log("\n✓ Supabase connection verified successfully.\n");
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
