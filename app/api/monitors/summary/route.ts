import { NextResponse } from "next/server";
import { getMonitorSummary } from "@/lib/monitors/server";
import { requireProUser } from "@/lib/plan/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireProUser("/api/monitors/summary");
  if (access instanceof NextResponse) return access;

  const summary = await getMonitorSummary();
  if ("error" in summary) {
    return NextResponse.json({ error: "Failed to load summary." }, { status: 500 });
  }

  return NextResponse.json(summary);
}
