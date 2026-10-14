import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/auth";
import { recoverStaleUpscaleJobs } from "@/lib/upscale-jobs/credits";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PROCESSING_STALE_SECONDS = 600;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    const message =
      process.env.NODE_ENV === "production" && !process.env.CRON_SECRET?.trim()
        ? "CRON_SECRET is not configured."
        : "Unauthorized.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  try {
    const touched = await recoverStaleUpscaleJobs(PROCESSING_STALE_SECONDS);
    return NextResponse.json({ ok: true, touched });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upscale recovery failed." },
      { status: 500 },
    );
  }
}
