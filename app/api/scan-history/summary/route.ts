import { NextResponse } from "next/server";
import { getScanHistorySummary } from "@/lib/scan-history/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getScanHistorySummary();

  if ("error" in result) {
    if (result.error === "unauthorized") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    return NextResponse.json(
      { error: result.message ?? "Could not load scan history summary." },
      { status: 500 },
    );
  }

  return NextResponse.json(result);
}
