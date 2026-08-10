import { NextResponse } from "next/server";
import { buildAccountExport, requireAccountUser } from "@/lib/account/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAccountUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const payload = await buildAccountExport(user.id);
    const filename = `scanonix-data-${user.id.slice(0, 8)}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not export account data.",
      },
      { status: 500 },
    );
  }
}
