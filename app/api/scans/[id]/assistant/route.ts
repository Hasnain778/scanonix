import { NextResponse } from "next/server";
import { isOpenAiConfigured } from "@/config/env";
import { generateScanAssistantResponse } from "@/lib/ai/scan-assistant/generate-response";
import { SCAN_ASSISTANT_LIMITS } from "@/lib/ai/scan-assistant/types";
import {
  limitReachedResponse,
  requireAuthenticatedPlan,
} from "@/lib/plan/access";
import { consumeUsage } from "@/lib/plan/usage";
import {
  appendScanAssistantMessage,
  listScanAssistantMessages,
} from "@/lib/scan-assistant/server";
import { getOwnedScanById } from "@/lib/scan-history/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

async function loadOwnedReport(scanId: string) {
  const owned = await getOwnedScanById(scanId, true);
  if ("error" in owned) {
    if (owned.error === "unauthorized") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  if (!owned.report) {
    return NextResponse.json({ error: "Scan report data is unavailable." }, { status: 404 });
  }

  if (owned.record.status !== "completed") {
    return NextResponse.json(
      { error: "The Security Copilot is available for completed scans only." },
      { status: 400 },
    );
  }

  return owned.report;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const route = "/api/scans/[id]/assistant";
  const access = await requireAuthenticatedPlan(route);
  if (access instanceof NextResponse) return access;

  const { id } = await context.params;
  const reportResult = await loadOwnedReport(id);
  if (reportResult instanceof NextResponse) return reportResult;

  const history = await listScanAssistantMessages(id);
  if ("error" in history) {
    if (history.error === "unauthorized") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    return NextResponse.json({ error: history.message ?? "Failed to load messages." }, { status: 500 });
  }

  return NextResponse.json({
    messages: history.messages,
    scanId: id,
    target: reportResult.target,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const route = "/api/scans/[id]/assistant";
  const rateLimited = enforceRateLimit(request, { route, limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const access = await requireAuthenticatedPlan(route);
  if (access instanceof NextResponse) return access;

  const { id } = await context.params;
  const reportResult = await loadOwnedReport(id);
  if (reportResult instanceof NextResponse) return reportResult;

  let body: { message?: string };
  try {
    body = (await request.json()) as { message?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const message = body.message?.trim().slice(0, SCAN_ASSISTANT_LIMITS.maxUserMessageLength);
  if (!message) {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
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

  const savedUser = await appendScanAssistantMessage({
    scanId: id,
    role: "user",
    content: message,
  });
  if ("error" in savedUser) {
    return NextResponse.json({ error: "Failed to save message." }, { status: 500 });
  }

  try {
    const response = await generateScanAssistantResponse({
      report: reportResult,
      history: existing.messages.map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
      userMessage: message,
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
      return NextResponse.json({ error: "Failed to save assistant response." }, { status: 500 });
    }

    return NextResponse.json({
      message: savedAssistant.message,
      userMessage: savedUser.message,
      source: response.source,
      ...usageMeta,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Assistant request failed." },
      { status: 500 },
    );
  }
}
