import { createClient } from "@supabase/supabase-js";
import { env, assertSupabaseConfigured } from "@/config/env";

export function createAdminClient() {
  assertSupabaseConfigured();

  if (!env.supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for billing webhooks and server-side profile updates.",
    );
  }

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
