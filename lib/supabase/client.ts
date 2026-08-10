import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertSupabaseConfiguredClient,
  publicEnv,
} from "@/config/env.public";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | null = null;

/** Reusable browser Supabase client (singleton). */
export function createClient(): SupabaseClient<Database> {
  assertSupabaseConfiguredClient();

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      publicEnv.supabaseUrl,
      publicEnv.supabasePublishableKey,
    );
  }

  return browserClient;
}

/** Reset singleton — useful in tests. */
export function resetBrowserClient(): void {
  browserClient = null;
}
