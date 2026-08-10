import { NextResponse } from "next/server";
import { countUserMonitors, createMonitor, listMonitors } from "@/lib/monitors/server";
import { isValidMonitorUrl } from "@/lib/monitors/scheduler";
import { MONITOR_LIMITS } from "@/lib/monitors/types";
import { requireProUser, forbiddenResponse } from "@/lib/plan/access";
import type { MonitorFrequency } from "@/lib/monitors/types";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const route = "/api/monitors";
  const access = await requireProUser(route);
  if (access instanceof NextResponse) return access;

  const result = await listMonitors();
  if ("error" in result) {
    return NextResponse.json({ error: "Failed to load monitors." }, { status: 500 });
  }

  return NextResponse.json({ monitors: result.monitors });
}

export async function POST(request: Request) {
  const route = "/api/monitors";
  const rateLimited = enforceRateLimit(request, { route, limit: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const access = await requireProUser(route);
  if (access instanceof NextResponse) return access;

  let body: { targetUrl?: string; label?: string; frequency?: MonitorFrequency };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const targetUrl = body.targetUrl?.trim();
  const frequency = body.frequency;

  if (!targetUrl || !isValidMonitorUrl(targetUrl)) {
    return NextResponse.json({ error: "A valid website URL is required." }, { status: 400 });
  }

  if (frequency !== "daily" && frequency !== "weekly" && frequency !== "monthly") {
    return NextResponse.json({ error: "frequency must be daily, weekly, or monthly." }, { status: 400 });
  }

  const limit = MONITOR_LIMITS[access.plan];
  const currentCount = await countUserMonitors(access.user.id);
  if (currentCount >= limit) {
    return forbiddenResponse(
      route,
      `Your ${access.plan} plan allows up to ${limit} monitored website${limit === 1 ? "" : "s"}. Upgrade to add more.`,
      access.plan,
    );
  }

  const result = await createMonitor({
    targetUrl,
    label: body.label,
    frequency,
  });

  if ("error" in result) {
    if (result.error === "unauthorized") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (result.error === "duplicate") {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }
    return NextResponse.json({ error: result.message ?? "Failed to create monitor." }, { status: 500 });
  }

  return NextResponse.json({ monitor: result.monitor }, { status: 201 });
}
