import { NextResponse } from "next/server";
import { listMonitorEvents, listMonitorRuns } from "@/lib/monitors/server";
import { requireProUser } from "@/lib/plan/access";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireProUser("/api/monitors/[id]/timeline");
  if (access instanceof NextResponse) return access;

  const { id } = await context.params;
  const url = new URL(request.url);
  const view = url.searchParams.get("view");

  if (view === "runs") {
    const result = await listMonitorRuns(id);
    if ("error" in result) {
      return NextResponse.json({ error: "Failed to load run history." }, { status: 500 });
    }
    return NextResponse.json({ runs: result.runs });
  }

  const result = await listMonitorEvents(id);
  if ("error" in result) {
    return NextResponse.json({ error: "Failed to load timeline." }, { status: 500 });
  }

  return NextResponse.json({ events: result.events });
}
