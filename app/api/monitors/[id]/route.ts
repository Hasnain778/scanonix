import { NextResponse } from "next/server";
import {
  deleteMonitor,
  getOwnedMonitor,
  updateMonitorFrequency,
  updateMonitorStatus,
} from "@/lib/monitors/server";
import type { MonitorFrequency } from "@/lib/monitors/types";
import { requireProUser } from "@/lib/plan/access";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireProUser("/api/monitors/[id]");
  if (access instanceof NextResponse) return access;

  const { id } = await context.params;
  const result = await getOwnedMonitor(id);

  if ("error" in result) {
    if (result.error === "unauthorized") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (result.error === "not_found") {
      return NextResponse.json({ error: "Monitor not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to load monitor." }, { status: 500 });
  }

  return NextResponse.json({ monitor: result.monitor });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireProUser("/api/monitors/[id]");
  if (access instanceof NextResponse) return access;

  const { id } = await context.params;

  let body: { status?: "active" | "paused"; frequency?: MonitorFrequency };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.status === "active" || body.status === "paused") {
    const result = await updateMonitorStatus(id, body.status);
    if ("error" in result) {
      return NextResponse.json({ error: "Failed to update monitor." }, { status: 500 });
    }
    return NextResponse.json({ monitor: result.monitor });
  }

  if (body.frequency === "daily" || body.frequency === "weekly" || body.frequency === "monthly") {
    const result = await updateMonitorFrequency(id, body.frequency);
    if ("error" in result) {
      return NextResponse.json({ error: "Failed to update monitor." }, { status: 500 });
    }
    return NextResponse.json({ monitor: result.monitor });
  }

  return NextResponse.json({ error: "Provide status or frequency." }, { status: 400 });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireProUser("/api/monitors/[id]");
  if (access instanceof NextResponse) return access;

  const { id } = await context.params;
  const result = await deleteMonitor(id);

  if ("error" in result) {
    return NextResponse.json({ error: "Failed to delete monitor." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
