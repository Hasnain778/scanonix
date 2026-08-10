import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { fetchAdminScans } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireAdminApi();
  if (access instanceof NextResponse) return access;

  const { searchParams } = new URL(request.url);
  const minRisk = searchParams.get("minRisk");

  try {
    const result = await fetchAdminScans({
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      targetType: searchParams.get("targetType") ?? undefined,
      minRisk: minRisk ? Number(minRisk) : undefined,
      limit: Number(searchParams.get("limit") ?? 50),
      offset: Number(searchParams.get("offset") ?? 0),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load scans." },
      { status: 500 },
    );
  }
}
