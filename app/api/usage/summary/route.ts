import { NextResponse } from "next/server";
import { requireAuthenticatedPlan } from "@/lib/plan/access";
import { getUsageSummary } from "@/lib/plan/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  const route = "/api/usage/summary";
  const access = await requireAuthenticatedPlan(route);
  if (access instanceof NextResponse) {
    return access;
  }

  try {
    const summary = await getUsageSummary(access.user.id, access.plan);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load usage summary.",
      },
      { status: 500 },
    );
  }
}
