import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { fetchAdminSubscriptions } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireAdminApi();
  if (access instanceof NextResponse) return access;

  try {
    const stats = await fetchAdminSubscriptions();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load subscriptions." },
      { status: 500 },
    );
  }
}
