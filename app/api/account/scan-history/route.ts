import { NextResponse } from "next/server";
import { deleteAllScanHistory, requireAccountUser } from "@/lib/account/server";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const user = await requireAccountUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: { confirm?: boolean } = {};
  try {
    body = (await request.json()) as { confirm?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.confirm !== true) {
    return NextResponse.json(
      { error: "Confirmation required to delete scan history." },
      { status: 400 },
    );
  }

  const { deleted, error } = await deleteAllScanHistory(user.id);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted });
}
