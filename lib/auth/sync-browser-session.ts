"use client";

import { createClient, resetBrowserClient } from "@/lib/supabase/client";
import { logAuthDebug, formatAuthError } from "@/lib/auth/auth-debug";

/** Force the browser Supabase client to reload auth state from cookies. */
export async function syncBrowserAuthSession() {
  resetBrowserClient();
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();

  logAuthDebug("syncBrowserAuthSession", {
    hasSession: Boolean(data.session),
    userId: data.session?.user.id ?? null,
    email: data.session?.user.email ?? null,
    ...formatAuthError(error),
  });

  return { session: data.session, error };
}

/** Returns true when the session belongs to an active password recovery flow. */
export function isPasswordRecoverySession(session: {
  user?: { recovery_sent_at?: string | null };
} | null): boolean {
  return Boolean(session?.user?.recovery_sent_at);
}
