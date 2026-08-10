import { NextResponse } from "next/server";
import {
  limitReachedResponse,
  requireAuthenticatedPlan,
  validateUploadSize,
} from "@/lib/plan/access";
import { consumeUsage } from "@/lib/plan/usage";

export const dynamic = "force-dynamic";

interface ConsumeBody {
  tool?: string;
  fileSizeBytes?: number;
}

export async function POST(request: Request) {
  const route = "/api/usage/consume";
  const access = await requireAuthenticatedPlan(route);
  if (access instanceof NextResponse) {
    return access;
  }

  let body: ConsumeBody = {};
  try {
    body = (await request.json()) as ConsumeBody;
  } catch {
    body = {};
  }

  const uploadError = validateUploadSize(route, body.fileSizeBytes, access.limits);
  if (uploadError) {
    return uploadError;
  }

  try {
    const result = await consumeUsage(access.user.id, access.plan);

    if (!result.allowed) {
      return limitReachedResponse(
        route,
        "Tool operation limit reached for your current plan.",
        {
          usageCount: result.usageCount,
          limit: result.limit,
          remaining: result.remaining,
          resetAt: result.resetAt,
        },
      );
    }

    return NextResponse.json({
      ok: true,
      tool: body.tool ?? null,
      plan: access.plan,
      usageCount: result.usageCount,
      limit: result.limit,
      remaining: result.remaining,
      resetAt: result.resetAt,
      priorityProcessing: access.limits.priorityProcessing,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not record tool usage.",
      },
      { status: 500 },
    );
  }
}
