import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public liveness probe — no auth, no database. */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
