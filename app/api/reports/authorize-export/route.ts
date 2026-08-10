import { NextResponse } from "next/server";
import { requirePremiumAiPlan } from "@/lib/plan/access";

export const dynamic = "force-dynamic";

interface AuthorizeBody {
  format?: string;
}

/** Authorize premium report exports — server plan check, no client trust. */
export async function POST(request: Request) {
  const route = "/api/reports/authorize-export";
  const access = await requirePremiumAiPlan(route);
  if (access instanceof NextResponse) {
    return access;
  }

  let body: AuthorizeBody = {};
  try {
    body = (await request.json()) as AuthorizeBody;
  } catch {
    body = {};
  }

  const format = body.format === "pdf" ? "pdf" : "json";

  return NextResponse.json({
    ok: true,
    format,
    plan: access.plan,
  });
}
