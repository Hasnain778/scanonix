import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getNotificationPreferences } from "@/lib/account/preferences";
import { getProfile } from "@/lib/auth/profile";

export async function buildAccountExport(userId: string) {
  const supabase = await createClient();
  const profile = await getProfile(userId);
  const preferences = await getNotificationPreferences(userId);

  const { data: scans, error: scansError } = await supabase
    .from("scan_history")
    .select(
      "id, target, target_type, risk_score, status, findings_count, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (scansError) {
    throw new Error(scansError.message);
  }

  const { data: usageRows } = await supabase
    .from("usage_counters")
    .select("action, usage_count, period_start, period_end, updated_at")
    .eq("user_id", userId);

  return {
    exportedAt: new Date().toISOString(),
    profile,
    notificationPreferences: preferences,
    scanHistory: scans ?? [],
    usage: usageRows ?? [],
  };
}

export async function deleteAllScanHistory(
  userId: string,
): Promise<{ deleted: number; error: string | null }> {
  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("scan_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) {
    return { deleted: 0, error: countError.message };
  }

  const { error } = await supabase.from("scan_history").delete().eq("user_id", userId);

  if (error) {
    return { deleted: 0, error: error.message };
  }

  return { deleted: count ?? 0, error: null };
}

export async function createAccountDeletionRequest(
  userId: string,
  email: string,
  reason?: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("account_deletion_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return { error: "You already have a pending account deletion request." };
  }

  const { error } = await supabase.from("account_deletion_requests").insert({
    user_id: userId,
    email,
    reason: reason?.trim() || null,
    status: "pending",
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function requireAccountUser() {
  return getAuthUser();
}
