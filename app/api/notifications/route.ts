import { NextResponse } from "next/server";
import { listUserNotifications } from "@/lib/monitors/server";
import { requireAuthenticatedPlan } from "@/lib/plan/access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireAuthenticatedPlan("/api/notifications");
  if (access instanceof NextResponse) return access;

  const result = await listUserNotifications();
  if ("error" in result) {
    return NextResponse.json({ error: "Failed to load notifications." }, { status: 500 });
  }

  return NextResponse.json({ notifications: result.notifications });
}

export async function PATCH(request: Request) {
  const access = await requireAuthenticatedPlan("/api/notifications");
  if (access instanceof NextResponse) return access;

  let body: { id?: string; markAllRead?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const supabase = await createClient();

  if (body.markAllRead) {
    await supabase
      .from("user_notifications")
      .update({ read: true })
      .eq("user_id", access.user.id)
      .eq("read", false);
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    await supabase
      .from("user_notifications")
      .update({ read: true })
      .eq("id", body.id)
      .eq("user_id", access.user.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Provide id or markAllRead." }, { status: 400 });
}
