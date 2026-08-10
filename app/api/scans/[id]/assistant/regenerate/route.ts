import { NextResponse } from "next/server";
import { isOpenAiConfigured } from "@/config/env";
import { generateScanAssistantResponse } from "@/lib/ai/scan-assistant/generate-response";
import {
  limitReachedResponse,
  requireAuthenticatedPlan,
} from "@/lib/plan/access";
import { consumeUsage } from "@/lib/plan/usage";
import {
  appendScanAssistantMessage,
  deleteLastAssistantMessage,
  getLastUserMessage,
  listScanAssistantMessages,
} from "@/lib/scan-assistant/server";
import { getOwnedScanById } from "@/lib/scan-history/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const route = "/api/scans/[id]/assistant/regenerate";
  const rateLimited = enforceRateLimit(request, { route, limit: 15, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const access = await requireAuthenticatedPlan(route);
  if (access instanceof NextResponse) return access;

  const { id } = await context.params;
  const owned = await getOwnedScanById(id, true);

  if ("error" in owned) {
    if (owned.error === "unauthorized") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  if (!owned.report || owned.record.status !== "completed") {
    return NextResponse.json({ error: "Scan report is unavailable." }, { status: 404 });
  }

  const deleted = await deleteLastAssistantMessage(id);
  if ("error" in deleted) {
    if (deleted.error === "not_found") {
      return NextResponse.json({ error: "No assistant response to regenerate." }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to regenerate response." }, { status: 500 });
  }

  const lastUser = await getLastUserMessage(id);
  if ("error" in lastUser) {
    return NextResponse.json({ error: "No user message to respond to." }, { status: 400 });
  }

  const preferCloudAi = access.limits.allowPremiumAi && isOpenAiConfigured();
  let usageMeta: { remaining?: number; resetAt?: string } = {};

  if (preferCloudAi) {
    const usage = await consumeUsage(access.user.id, access.plan);
    if (!usage.allowed) {
      return limitReachedResponse(route, "Tool operation limit reached for your current plan.", {
        usageCount: usage.usageCount,
        limit: usage.limit,
        remaining: usage.remaining,
        resetAt: usage.resetAt,
      });
    }
    usageMeta = { remaining: usage.remaining, resetAt: usage.resetAt };
  }

  const existing = await listScanAssistantMessages(id);
  if ("error" in existing) {
    return NextResponse.json({ error: "Failed to load conversation history." }, { status: 500 });
  }

  const historyWithoutLastUser = existing.messages
    .filter((entry) => entry.id !== lastUser.message.id)
    .map((entry) => ({ role: entry.role, content: entry.content }));

  try {
    const response = await generateScanAssistantResponse({
      report: owned.report,
      history: historyWithoutLastUser,
      userMessage: lastUser.message.content,
      preferCloudAi,
    });

    const savedAssistant = await appendScanAssistantMessage({
      scanId: id,
      role: "assistant",
      content: response.content,
      source: response.source,
      tokensUsed: response.tokensUsed,
    });

    if ("error" in savedAssistant) {
      return NextResponse.json({ error: "Failed to save regenerated response." }, { status: 500 });
    }

    return NextResponse.json({
      message: savedAssistant.message,
      source: response.source,
      ...usageMeta,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Regeneration failed." },
      { status: 500 },
    );
  }
}
