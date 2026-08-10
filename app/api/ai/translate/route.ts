import { NextResponse } from "next/server";
import { OpenAiError, translateTextAdvanced } from "@/lib/ai/openai-server";
import {
  AI_TRANSLATION_UNAVAILABLE,
  TRANSLATION_INVALID_LANGUAGE,
  TRANSLATION_RATE_LIMIT,
} from "@/lib/ai/messages";
import {
  limitReachedResponse,
  requirePremiumAiPlan,
  validateUploadSize,
} from "@/lib/plan/access";
import { consumeUsage } from "@/lib/plan/usage";
import {
  checkRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";
import {
  isValidSourceLanguage,
  isValidTargetLanguage,
} from "@/lib/ai/translation-languages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IP_HOURLY_LIMIT = 10;
const IP_WINDOW_MS = 60 * 60 * 1000;

function mapTranslationError(error: OpenAiError): string {
  if (error.code === "service_unavailable" || error.status === 503 || error.status === 502) {
    return AI_TRANSLATION_UNAVAILABLE;
  }
  return error.message;
}

export async function POST(request: Request) {
  const route = "/api/ai/translate";

  const ip = getClientIp(request);
  const ipLimit = checkRateLimit({
    route: `${route}:ip-hourly`,
    identifier: ip,
    limit: IP_HOURLY_LIMIT,
    windowMs: IP_WINDOW_MS,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: TRANSLATION_RATE_LIMIT },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSec ?? 3600) },
      },
    );
  }

  const rateLimited = enforceRateLimit(request, { route, limit: 30, windowMs: 60_000 });
  if (rateLimited) {
    return NextResponse.json({ error: TRANSLATION_RATE_LIMIT }, { status: 429 });
  }

  const access = await requirePremiumAiPlan(route);
  if (access instanceof NextResponse) {
    return access;
  }

  try {
    const body = (await request.json()) as {
      text?: string;
      sourceLanguage?: string;
      targetLanguage?: string;
      fileSizeBytes?: number;
    };

    const sourceLanguage = body.sourceLanguage?.trim() ?? "";
    const targetLanguage = body.targetLanguage?.trim() ?? "";

    if (!isValidSourceLanguage(sourceLanguage) || !isValidTargetLanguage(targetLanguage)) {
      return NextResponse.json({ error: TRANSLATION_INVALID_LANGUAGE }, { status: 400 });
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

    const result = await translateTextAdvanced(
      body.text ?? "",
      sourceLanguage,
      targetLanguage,
    );

    return NextResponse.json({
      translatedText: result.translatedText,
      detectedLanguage: result.detectedLanguage,
      text: result.translatedText,
      remaining: usage.remaining,
      resetAt: usage.resetAt,
    });
  } catch (error) {
    if (error instanceof OpenAiError) {
      return NextResponse.json(
        { error: mapTranslationError(error) },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: AI_TRANSLATION_UNAVAILABLE }, { status: 500 });
  }
}
