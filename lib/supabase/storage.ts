import { createClient } from "@/lib/supabase/server";

export const AVATARS_BUCKET = "avatars";
export const USER_FILES_BUCKET = "user-files";

export function getPublicUrl(bucket: string, path: string): string {
  // Synchronous URL builder for display — actual upload uses createClient()
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

export async function uploadUserFile(
  userId: string,
  file: File,
  bucket = USER_FILES_BUCKET,
): Promise<{ path: string | null; error: string | null }> {
  const supabase = await createClient();
  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
  const path = `${userId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) {
    return { path: null, error: error.message };
  }

  return { path, error: null };
}

export async function deleteUserFile(
  bucket: string,
  path: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return { error: error?.message ?? null };
}

export async function listUserFiles(
  userId: string,
  bucket = USER_FILES_BUCKET,
): Promise<Array<{ name: string; id: string; created_at: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).list(userId);

  if (error) {
    console.error("[supabase/storage] listUserFiles:", error.message);
    return [];
  }

  return (data ?? []).map((item) => ({
    name: item.name,
    id: item.id ?? item.name,
    created_at: item.created_at ?? new Date().toISOString(),
  }));
}
