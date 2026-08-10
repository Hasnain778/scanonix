import { createClient } from "@/lib/supabase/server";
import type { NotificationPreferences } from "@/types/auth";

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<
  NotificationPreferences,
  "user_id" | "created_at" | "updated_at"
> = {
  scan_completed: true,
  high_risk_found: true,
  weekly_summary: true,
  billing_alerts: true,
  product_updates: false,
};

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch notification preferences:", error.message);
  }

  if (data) {
    return data as NotificationPreferences;
  }

  const { data: created, error: insertError } = await supabase
    .from("user_notification_preferences")
    .insert({ user_id: userId, ...DEFAULT_NOTIFICATION_PREFERENCES })
    .select("*")
    .single();

  if (insertError || !created) {
    const now = new Date().toISOString();
    return {
      user_id: userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      created_at: now,
      updated_at: now,
    };
  }

  return created as NotificationPreferences;
}

export async function updateNotificationPreferences(
  userId: string,
  updates: Partial<
    Pick<
      NotificationPreferences,
      | "scan_completed"
      | "high_risk_found"
      | "weekly_summary"
      | "billing_alerts"
      | "product_updates"
    >
  >,
): Promise<{ preferences: NotificationPreferences | null; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_notification_preferences")
    .upsert(
      {
        user_id: userId,
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...updates,
      },
      { onConflict: "user_id" },
    )
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    return { preferences: null, error: error.message };
  }

  return { preferences: data as NotificationPreferences, error: null };
}
