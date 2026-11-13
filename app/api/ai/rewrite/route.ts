import { NextResponse } from "next/server";
import { isOpenAiConfigured } from "@/config/env";
import {
  isValidRewriteLength,
  isValidRewriteTone,
  OpenAiError,
  REWRITE_MAX_CHARACTERS,
  rewriteText,
  type RewriteLength,
  type RewriteTone,
} from "@/lib/ai/openai-server";
import { AI_REWRITE_UNAVAILABLE } from "@/lib/ai/messages";
import {
  limitReachedResponse,
  requirePremiumAiPlan,
  validateUploadSize,
} from "@/lib/plan/access";
import { runWithReservedUsage } from "@/lib/ai/reserved-usage";
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
    const text = typeof body.text === "string" ? body.text : "";
    const trimmed = text.trim();

    if (!isValidRewriteTone(tone)) {
      return NextResponse.json({ error: "Please choose a valid tone." }, { status: 400 });
    }
    if (!isValidRewriteLength(length)) {
      return NextResponse.json({ error: "Please choose a valid length option." }, { status: 400 });
    }
    if (!trimmed) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }
    if (trimmed.length > REWRITE_MAX_CHARACTERS) {
      return NextResponse.json(
        {
          error: `Text exceeds the ${REWRITE_MAX_CHARACTERS.toLocaleString()} character limit.`,
        },
        { status: 400 },
      );
    }

    const uploadError = validateUploadSize(route, body.fileSizeBytes, access.limits);
    if (uploadError) {
      return uploadError;
    }

    if (!isOpenAiConfigured()) {
      return NextResponse.json({ error: AI_REWRITE_UNAVAILABLE }, { status: 503 });
    }

    const reserved = await runWithReservedUsage({
      userId: access.user.id,
      plan: access.plan,
      run: () =>
        rewriteText(
          text,
          tone as RewriteTone,
          length as RewriteLength,
          body.preserveMeaning !== false,
        ),
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
      return NextResponse.json(
        { error: mapRewriteError(error) },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: AI_REWRITE_UNAVAILABLE }, { status: 500 });
  }
}
