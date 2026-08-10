import { NextResponse } from "next/server";
import {
  require4KExportPlan,
  validateUploadSize,
} from "@/lib/plan/access";
import { getPlanLimits } from "@/lib/plan/config";

export const dynamic = "force-dynamic";

interface AuthorizeExportBody {
  resolution?: string;
  fileSizeBytes?: number;
}

export async function POST(request: Request) {
  const route = "/api/tools/background-remover/authorize-export";

  let body: AuthorizeExportBody = {};
  try {
    body = (await request.json()) as AuthorizeExportBody;
  } catch {
    body = {};
  }

  const resolution = body.resolution === "4k" ? "4k" : "hd";

  if (resolution === "4k") {
    const premiumAccess = await require4KExportPlan(route);
    if (premiumAccess instanceof NextResponse) {
      return premiumAccess;
    }

    if (
      body.fileSizeBytes &&
      body.fileSizeBytes > premiumAccess.limits.maxUploadBytes
    ) {
      return NextResponse.json(
        {
          error: `File exceeds the ${premiumAccess.plan} plan upload limit.`,
          code: "plan_restricted",
          allowedResolution: "hd",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      allowedResolution: "4k",
      plan: premiumAccess.plan,
    });
  }

  const freeLimits = getPlanLimits("free");
  const uploadError = validateUploadSize(route, body.fileSizeBytes, freeLimits);
  if (uploadError) {
    return uploadError;
  }

  return NextResponse.json({
    ok: true,
    allowedResolution: "hd",
    plan: "free",
  });
}
