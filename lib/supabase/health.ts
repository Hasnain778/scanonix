import { isSupabaseConfigured } from "@/config/env";
import { createAnonymousClient } from "@/lib/supabase/server";
import { checkPublicAvatarsBucket, checkUserFilesBucket } from "@/lib/supabase/storage-health";

export interface SupabaseHealthResult {
  ok: boolean;
  configured: boolean;
  url: string | null;
  auth: { ok: boolean; message: string };
  database: { ok: boolean; message: string };
  storage: { ok: boolean; message: string };
  checkedAt: string;
}

/** Verify Supabase auth, database, and storage connectivity. */
export async function verifySupabaseConnection(): Promise<SupabaseHealthResult> {
  const checkedAt = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      configured: false,
      url: null,
      auth: {
        ok: false,
        message:
          "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
      },
      database: { ok: false, message: "Skipped — not configured." },
      storage: { ok: false, message: "Skipped — not configured." },
      checkedAt,
    };
  }

  const supabase = createAnonymousClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null;

  const authResult = await supabase.auth.getSession();
  const auth = authResult.error
    ? { ok: false, message: authResult.error.message }
    : { ok: true, message: "Auth API reachable." };

  const { error: dbError } = await supabase.from("profiles").select("id").limit(1);
  const database = dbError
    ? {
        ok: false,
        message: dbError.message.includes("does not exist")
          ? "Connected, but profiles table not found — run supabase/migrations/001_profiles.sql"
          : dbError.message,
      }
    : { ok: true, message: "Database reachable (profiles table OK)." };

  const avatars = await checkPublicAvatarsBucket();
  const userFiles = await checkUserFilesBucket();

  const storage = avatars.exists
    ? {
        ok: true,
        message: `Storage reachable (${avatars.detail}; user-files: ${userFiles.exists ? userFiles.detail : "not detected"}).`,
      }
    : {
        ok: false,
        message: `avatars bucket not found — ${avatars.detail}`,
      };

  const ok = auth.ok && database.ok && storage.ok;

  return { ok, configured: true, url, auth, database, storage, checkedAt };
}
