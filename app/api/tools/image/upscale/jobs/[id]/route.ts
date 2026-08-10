import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/config/env";
import { requirePremiumAiPlan } from "@/lib/plan/access";
import { getJobForUser } from "@/lib/upscale-jobs/repository";
import { toPublicJobStatus } from "@/lib/upscale-jobs/public-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROUTE = "/api/tools/image/upscale/jobs/[id]";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Async upscaling is not configured.", code: "NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const access = await requirePremiumAiPlan(ROUTE);
  if (access instanceof NextResponse) {
    return access;
  }

  const { id: jobId } = await context.params;
  if (!jobId) {
    return NextResponse.json({ error: "Job id is required." }, { status: 400 });
  }

  try {
    const job = await getJobForUser(access.user.id, jobId);
    if (!job) {
      return NextResponse.json({ error: "Upscale job not found." }, { status: 404 });
    }

    return NextResponse.json(toPublicJobStatus(job));
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not load upscale job.",
      },
      { status: 500 },
    );
  }
}
