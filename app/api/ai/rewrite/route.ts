import { NextResponse } from "next/server";
import {
  isValidRewriteLength,
  isValidRewriteTone,
  OpenAiError,
  rewriteText,
} from "@/lib/ai/openai-server";
import { AI_REWRITE_UNAVAILABLE } from "@/lib/ai/messages";
import {
  limitReachedResponse,
  requirePremiumAiPlan,
  validateUploadSize,
} from "@/lib/plan/access";
import { consumeUsage } from "@/lib/plan/usage";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function mapRewriteError(error: OpenAiError): string {
  if (error.code === "service_unavailable" || error.status === 503 || error.status === 502) {
    return AI_REWRITE_UNAVAILABLE;
  }
  return error.message;
}

export async function POST(request: Request) {
  const route = "/api/ai/rewrite";
  const rateLimited = enforceRateLimit(request, { route, limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const access = await requirePremiumAiPlan(route);
  if (access instanceof NextResponse) {
    return access;
  }

  try {
    const body = (await request.json()) as {
      text?: string;
      tone?: string;
      length?: string;
      preserveMeaning?: boolean;
      fileSizeBytes?: number;
    };

    const tone = body.tone?.trim() ?? "";
    const length = body.length?.trim() ?? "";

    if (!isValidRewriteTone(tone)) {
      return NextResponse.json({ error: "Please choose a valid tone." }, { status: 400 });
    }
    if (!isValidRewriteLength(length)) {
      return NextResponse.json({ error: "Please choose a valid length option." }, { status: 400 });
    }

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

    const rewritten = await rewriteText(
      body.text ?? "",
      tone,
      length,
      body.preserveMeaning !== false,
    );

    return NextResponse.json({
      text: rewritten,
      remaining: usage.remaining,
      resetAt: usage.resetAt,
    });
  } catch (error) {
    if (error instanceof OpenAiError) {
      return NextResponse.json(
        { error: mapRewriteError(error) },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: AI_REWRITE_UNAVAILABLE }, { status: 500 });
  }
}
