import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { fetchAdminUserDetail, updateUserStatus } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminApi();
  if (access instanceof NextResponse) return access;

  const { id } = await context.params;

  try {
    const user = await fetchAdminUserDetail(id);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load user." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminApi();
  if (access instanceof NextResponse) return access;

  const { id } = await context.params;

  if (id === access.id) {
    return NextResponse.json({ error: "You cannot suspend your own account." }, { status: 400 });
  }

  let body: { status?: "active" | "suspended" };
  try {
    body = (await request.json()) as { status?: "active" | "suspended" };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.status !== "active" && body.status !== "suspended") {
    return NextResponse.json({ error: "status must be active or suspended." }, { status: 400 });
  }

  try {
    await updateUserStatus(id, body.status);
    return NextResponse.json({ ok: true, status: body.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update user." },
      { status: 500 },
    );
  }
}
