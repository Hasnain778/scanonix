import { NextResponse } from "next/server";
import { canUsePremiumAI } from "@/lib/auth/entitlements";
import { getAuthUser } from "@/lib/auth/session";
import { requirePremiumAiPlan } from "@/lib/plan/access";

/** @deprecated Prefer requirePremiumAiPlan from @/lib/plan/access */
export async function requirePremiumAiAccess() {
  const response = await requirePremiumAiPlan("/api/ai/legacy");
  if (response instanceof NextResponse) {
    return { errorResponse: response };
  }

  return { user: response.user };
}

export { canUsePremiumAI, getAuthUser };
