import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/auth";
import { runMonitorScheduler } from "@/lib/monitors/runner";
import { processPendingEmailNotifications } from "@/lib/monitors/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    const message =
      process.env.NODE_ENV === "production" && !process.env.CRON_SECRET?.trim()
        ? "CRON_SECRET is not configured."
        : "Unauthorized.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  try {
    const scheduler = await runMonitorScheduler();
    const email = await processPendingEmailNotifications();

    return NextResponse.json({
      ok: true,
      ...scheduler,
      emailsProcessed: email.processed,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scheduler failed." },
      { status: 500 },
    );
  }
}
