import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/auth";
import { verifySupabaseConnection } from "@/lib/supabase/health";

export const dynamic = "force-dynamic";

/** GET /api/health/supabase — detailed Supabase check (protected in production). */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" && !verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await verifySupabaseConnection();

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        ok: result.ok,
        configured: result.configured,
        checkedAt: result.checkedAt,
      },
      { status: result.ok ? 200 : 503 },
    );
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
