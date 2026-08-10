import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { fetchAdminUsers } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireAdminApi();
  if (access instanceof NextResponse) return access;

  const { searchParams } = new URL(request.url);

  try {
    const result = await fetchAdminUsers({
      search: searchParams.get("search") ?? undefined,
      plan: searchParams.get("plan") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      limit: Number(searchParams.get("limit") ?? 50),
      offset: Number(searchParams.get("offset") ?? 0),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load users." },
      { status: 500 },
    );
  }
}
