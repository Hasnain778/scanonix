import type { Profile } from "@/types/auth";
import { createClient } from "@/lib/supabase/server";

/** Fetch a profile by user id. */
export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[supabase/database] getProfile:", error.message);
    return null;
  }

  return data;
}

/** Update profile fields for the authenticated user. */
export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, "full_name" | "avatar_url" | "plan">>,
): Promise<{ data: Profile | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/** List profiles — admin-only in production; prepared for future dashboard admin. */
export async function listProfiles(limit = 50): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .limit(limit);

  if (error) {
    console.error("[supabase/database] listProfiles:", error.message);
    return [];
  }

  return data ?? [];
}
