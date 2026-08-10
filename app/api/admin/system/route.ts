import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { fetchAdminSystemStatus } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireAdminApi();
  if (access instanceof NextResponse) return access;

  try {
    const status = await fetchAdminSystemStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load system status." },
      { status: 500 },
    );
  }
}
