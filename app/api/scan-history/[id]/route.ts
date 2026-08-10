import { NextResponse } from "next/server";
import { deleteOwnedScan, getOwnedScanById } from "@/lib/scan-history/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const includeReport = new URL(request.url).searchParams.get("include") === "report";

  const result = await getOwnedScanById(id, includeReport);

  if ("error" in result) {
    if (result.error === "unauthorized") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (result.error === "not_found") {
      return NextResponse.json({ error: "Scan not found." }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.message ?? "Could not load scan." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    record: result.record,
    report: result.report,
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = await deleteOwnedScan(id);

  if ("error" in result) {
    if (result.error === "unauthorized") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (result.error === "not_found") {
      return NextResponse.json({ error: "Scan not found." }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.message ?? "Could not delete scan." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
