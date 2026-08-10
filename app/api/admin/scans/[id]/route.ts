import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { deleteAdminScan } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminApi();
  if (access instanceof NextResponse) return access;

  const { id } = await context.params;

  try {
    await deleteAdminScan(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete scan." },
      { status: 500 },
    );
  }
}
