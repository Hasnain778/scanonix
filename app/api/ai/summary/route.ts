import { NextResponse } from "next/server";
import { isOpenAiConfigured } from "@/config/env";
import { OpenAiError, summarizeText } from "@/lib/ai/openai-server";
import { AI_SUMMARY_UNAVAILABLE } from "@/lib/ai/messages";
import {
  limitReachedResponse,
  requirePremiumAiPlan,
  validateUploadSize,
} from "@/lib/plan/access";
import { runWithReservedUsage } from "@/lib/ai/reserved-usage";
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

    if (!isOpenAiConfigured()) {
      return NextResponse.json({ error: AI_SUMMARY_UNAVAILABLE }, { status: 503 });
    }

    const reserved = await runWithReservedUsage({
      userId: access.user.id,
      plan: access.plan,
      run: () => summarizeText(body.text ?? ""),
    });

    if (reserved.status === "denied") {
      return limitReachedResponse(
        route,
        "Tool operation limit reached for your current plan.",
        {
          usageCount: reserved.usage.usageCount,
          limit: reserved.usage.limit,
          remaining: reserved.usage.remaining,
          resetAt: reserved.usage.resetAt,
        },
      );
    }

    return NextResponse.json({
      text: reserved.value,
      remaining: reserved.usage.remaining,
      resetAt: reserved.usage.resetAt,
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
