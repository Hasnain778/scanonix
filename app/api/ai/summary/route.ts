import { NextResponse } from "next/server";
import { OpenAiError, summarizeText } from "@/lib/ai/openai-server";
import { AI_SUMMARY_UNAVAILABLE } from "@/lib/ai/messages";
import {
  limitReachedResponse,
  requirePremiumAiPlan,
  validateUploadSize,
} from "@/lib/plan/access";
import { consumeUsage } from "@/lib/plan/usage";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const route = "/api/ai/summary";
  const rateLimited = enforceRateLimit(request, { route, limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const access = await requirePremiumAiPlan(route);
  if (access instanceof NextResponse) {
    return access;
  }

  try {
    const body = (await request.json()) as { text?: string; fileSizeBytes?: number };
    const uploadError = validateUploadSize(route, body.fileSizeBytes, access.limits);
    if (uploadError) {
      return uploadError;
    }

    const usage = await consumeUsage(access.user.id, access.plan);
    if (!usage.allowed) {
      return limitReachedResponse(
        route,
        "Tool operation limit reached for your current plan.",
        {
          usageCount: usage.usageCount,
          limit: usage.limit,
          remaining: usage.remaining,
          resetAt: usage.resetAt,
        },
      );
    }

    const summary = await summarizeText(body.text ?? "");
    return NextResponse.json({
      text: summary,
      remaining: usage.remaining,
      resetAt: usage.resetAt,
    });
  } catch (error) {
    if (error instanceof OpenAiError) {
      const message =
        error.code === "service_unavailable" || error.status === 503
          ? AI_SUMMARY_UNAVAILABLE
          : error.message;
      return NextResponse.json({ error: message }, { status: error.status });
    }
    return NextResponse.json({ error: AI_SUMMARY_UNAVAILABLE }, { status: 500 });
  }
}
