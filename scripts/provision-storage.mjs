/**
 * Create Supabase storage buckets using the service role key.
 * Run: npm run provision:storage
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (server-only, never commit).
 * Alternative: run supabase/migrations/002_storage_buckets.sql in SQL Editor.
 */

import { createClient } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

const BUCKETS = [
  { id: "avatars", public: true },
  { id: "user-files", public: false },
];

function fail(message) {
  console.error(`\n✗ Storage provisioning failed: ${message}\n`);
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

async function main() {
  if (!url) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  }

  if (!serviceRoleKey) {
    fail(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local temporarily, or run supabase/migrations/002_storage_buckets.sql in the Supabase SQL Editor.",
    );
  }

  console.log(`\nProvisioning storage buckets at ${url} …\n`);

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const bucket of BUCKETS) {
    const { data: existing } = await supabase.storage.getBucket(bucket.id);

    if (existing) {
      ok(`Bucket "${bucket.id}" already exists`);
      continue;
    }

    const { error } = await supabase.storage.createBucket(bucket.id, {
      public: bucket.public,
    });

    if (error) {
      fail(`Could not create bucket "${bucket.id}": ${error.message}`);
    }

    ok(`Created bucket "${bucket.id}" (public: ${bucket.public})`);
  }

  console.log("\n✓ Storage buckets provisioned.\n");
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
