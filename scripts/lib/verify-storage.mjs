/**
 * Verify Supabase Storage buckets via the official Storage API (@supabase/supabase-js).
 *
 * listBuckets() is unavailable to publishable keys (returns []). Instead:
 * - Public buckets: GET /storage/v1/object/public/{bucket}/… (404 object vs bucket)
 * - All buckets: storage.from(bucket).upload() — "Bucket not found" vs RLS/policy errors
 */

import { createClient } from "@supabase/supabase-js";

function createStorageClient(url, publishableKey) {
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * @param {string} url
 * @param {string} publishableKey
 * @param {string} bucketId
 * @returns {Promise<{ exists: boolean; detail: string }>}
 */
export async function checkStorageBucket(url, publishableKey, bucketId) {
  const supabase = createStorageClient(url, publishableKey);

  const { error } = await supabase.storage.from(bucketId).upload(
    ".scanonix-bucket-check",
    new Uint8Array([0]),
    { upsert: true, contentType: "text/plain" },
  );

  if (!error) {
    await supabase.storage.from(bucketId).remove([".scanonix-bucket-check"]);
    return { exists: true, detail: "bucket reachable via Storage API upload" };
  }

  const message = error.message ?? String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("bucket not found") ||
    lower.includes("does not exist") ||
    error.statusCode === 404 ||
    error.statusCode === "404"
  ) {
    return { exists: false, detail: message };
  }

  return {
    exists: true,
    detail: "bucket reachable via Storage API (upload restricted by policy, as expected)",
  };
}

/**
 * @param {string} url
 * @param {string} publishableKey
 * @returns {Promise<{ exists: boolean; public: boolean; detail: string }>}
 */
export async function checkPublicAvatarsBucket(url, publishableKey) {
  const supabase = createStorageClient(url, publishableKey);
  const { data } = supabase.storage.from("avatars").getPublicUrl(".scanonix-bucket-check");

  const publicRes = await fetch(data.publicUrl, {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
    },
  });
  const publicBody = await publicRes.text();
  const lower = publicBody.toLowerCase();

  if (lower.includes("bucket not found")) {
    return { exists: false, public: false, detail: "avatars bucket not found" };
  }

  if (lower.includes("object not found") || lower.includes('"not_found"') || publicRes.ok) {
    return {
      exists: true,
      public: true,
      detail: "avatars public bucket reachable via Storage API",
    };
  }

  return checkStorageBucket(url, publishableKey, "avatars").then((result) => ({
    exists: result.exists,
    public: result.exists,
    detail: result.detail,
  }));
}

/**
 * @param {string} url
 * @param {string} publishableKey
 * @returns {Promise<{ avatars: object; userFiles: object }>}
 */
export async function verifyStorageBuckets(url, publishableKey) {
  const [avatars, userFiles] = await Promise.all([
    checkPublicAvatarsBucket(url, publishableKey),
    checkStorageBucket(url, publishableKey, "user-files"),
  ]);
  return { avatars, userFiles };
}
