import { NextResponse } from "next/server";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/account/preferences";
import { requireAccountUser } from "@/lib/account/server";
import type { NotificationPreferenceKey } from "@/types/auth";

export const dynamic = "force-dynamic";

const PREFERENCE_KEYS: NotificationPreferenceKey[] = [
  "scan_completed",
  "high_risk_found",
  "weekly_summary",
  "billing_alerts",
  "product_updates",
];

export async function GET() {
  const user = await requireAccountUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const preferences = await getNotificationPreferences(user.id);
  return NextResponse.json(preferences);
}

export async function PATCH(request: Request) {
  const user = await requireAccountUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const updates: Partial<Record<NotificationPreferenceKey, boolean>> = {};
  for (const key of PREFERENCE_KEYS) {
    if (key in body) {
      if (typeof body[key] !== "boolean") {
        return NextResponse.json(
          { error: `Invalid value for ${key}.` },
          { status: 400 },
        );
      }
      updates[key] = body[key] as boolean;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid preferences provided." }, { status: 400 });
  }

  const { preferences, error } = await updateNotificationPreferences(user.id, updates);
  if (error || !preferences) {
    return NextResponse.json(
      { error: error ?? "Could not save preferences." },
      { status: 500 },
    );
  }

  return NextResponse.json(preferences);
}
