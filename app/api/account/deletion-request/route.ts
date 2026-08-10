import { NextResponse } from "next/server";
import { createAccountDeletionRequest, requireAccountUser } from "@/lib/account/server";
import { sanitizeTextInput } from "@/lib/validators/account";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireAccountUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: { confirmation?: string; reason?: string } = {};
  try {
    body = (await request.json()) as { confirmation?: string; reason?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.confirmation !== "DELETE") {
    return NextResponse.json(
      { error: 'Type "DELETE" to confirm account deletion.' },
      { status: 400 },
    );
  }

  const reason = body.reason ? sanitizeTextInput(body.reason, 500) : undefined;
  const { error } = await createAccountDeletionRequest(user.id, user.email, reason);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message:
      "Your account deletion request has been submitted. Our team will process it shortly.",
  });
}
