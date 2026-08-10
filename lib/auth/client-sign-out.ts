"use client";

import { createClient, resetBrowserClient } from "@/lib/supabase/client";

/** Sign out via the browser Supabase client (clears session storage/cookies and emits SIGNED_OUT). */
export async function clientSignOut(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  resetBrowserClient();
  if (error) {
    throw error;
  }
}
