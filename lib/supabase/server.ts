import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { assertSupabaseConfigured, env } from "@/config/env";
import type { Database } from "@/types/database";

/** Reusable server Supabase client with cookie-based auth session. */
export async function createClient(): Promise<SupabaseClient<Database>> {
  assertSupabaseConfigured();

  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component — middleware handles session refresh.
        }
      },
    },
  });
}

/** Server client without cookies — for health checks and anonymous reads. */
export function createAnonymousClient(): SupabaseClient<Database> {
  assertSupabaseConfigured();

  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // no-op
      },
    },
  });
}
