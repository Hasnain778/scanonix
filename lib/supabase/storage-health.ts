import { createAnonymousClient } from "@/lib/supabase/server";

export interface StorageBucketCheck {
  exists: boolean;
  detail: string;
}

export interface PublicAvatarsCheck extends StorageBucketCheck {
  public: boolean;
}

async function probeBucketUpload(bucketId: string): Promise<StorageBucketCheck> {
  const supabase = createAnonymousClient();
  const probePath = ".scanonix-bucket-check";

  const { error } = await supabase.storage.from(bucketId).upload(
    probePath,
    new Uint8Array([0]),
    { upsert: true, contentType: "text/plain" },
  );

  if (!error) {
    await supabase.storage.from(bucketId).remove([probePath]);
    return { exists: true, detail: "bucket reachable via Storage API upload" };
  }

  const message = error.message ?? "Storage API error";
  const lower = message.toLowerCase();

  if (
    lower.includes("bucket not found") ||
    lower.includes("does not exist") ||
    String(error.statusCode) === "404"
  ) {
    return { exists: false, detail: message };
  }

  return {
    exists: true,
    detail: "bucket reachable via Storage API (upload restricted by policy, as expected)",
  };
}

/** Detect bucket via Storage API upload probe — works with publishable key. */
export async function checkStorageBucket(
  bucketId: string,
): Promise<StorageBucketCheck> {
  return probeBucketUpload(bucketId);
}

export async function checkPublicAvatarsBucket(): Promise<PublicAvatarsCheck> {
  const supabase = createAnonymousClient();
  const { data } = supabase.storage
    .from("avatars")
    .getPublicUrl(".scanonix-bucket-check");

  const publicRes = await fetch(data.publicUrl);
  const body = await publicRes.text();
  const lower = body.toLowerCase();

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

  const fallback = await probeBucketUpload("avatars");
  return {
    exists: fallback.exists,
    public: fallback.exists,
    detail: fallback.detail,
  };
}

export async function checkUserFilesBucket(): Promise<StorageBucketCheck> {
  return probeBucketUpload("user-files");
}
