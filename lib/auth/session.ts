import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/config/env";
import { getProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";

export async function getAuthUser(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return null;
  }

  const profile = await getProfile(user.id);

  return {
    id: user.id,
    email: user.email,
    profile,
  };
}

export async function requireAuth(redirectTo = "/login"): Promise<AuthUser> {
  if (!isSupabaseConfigured()) {
    redirect(redirectTo);
  }

  const user = await getAuthUser();
  if (!user) {
    redirect(redirectTo);
  }
  return user;
}
