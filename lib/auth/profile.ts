import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/auth";

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch profile:", error.message);
    return null;
  }

  return data as Profile | null;
}

export type ProfileFieldUpdates = Partial<
  Pick<
    Profile,
    | "full_name"
    | "avatar_url"
    | "company_name"
    | "job_title"
    | "country"
    | "time_zone"
  >
>;

export async function updateProfileFields(
  userId: string,
  updates: ProfileFieldUpdates,
): Promise<{ profile: Profile | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    return { profile: null, error: error.message };
  }

  return { profile: data as Profile, error: null };
}

export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filePath = `${userId}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { url: null, error: uploadError.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(filePath);

  const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;
  const { error } = await updateProfileFields(userId, {
    avatar_url: cacheBustedUrl,
  });

  if (error) {
    return { url: null, error };
  }

  return { url: cacheBustedUrl, error: null };
}

export async function removeAvatar(
  userId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: files, error: listError } = await supabase.storage
    .from("avatars")
    .list(userId);

  if (listError) {
    return { error: listError.message };
  }

  if (files && files.length > 0) {
    const paths = files.map((file) => `${userId}/${file.name}`);
    const { error: removeError } = await supabase.storage
      .from("avatars")
      .remove(paths);

    if (removeError) {
      return { error: removeError.message };
    }
  }

  const { error } = await updateProfileFields(userId, { avatar_url: null });
  return { error };
}
