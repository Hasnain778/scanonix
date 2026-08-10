import { NextResponse } from "next/server";
import { isAccountActive } from "@/lib/auth/admin";
import { getEffectivePlan } from "@/lib/auth/entitlements";
import { getAuthUser } from "@/lib/auth/session";
import { getPlanLimits, type PlanLimits } from "@/lib/plan/config";
import { logPlanEnforcement } from "@/lib/plan/logger";
import { getToolAccess } from "@/lib/plan/tool-access";
import type { AuthUser } from "@/types/auth";
import type { UserPlan } from "@/types/auth";

export interface AuthenticatedPlanContext {
  user: AuthUser;
  plan: UserPlan;
  limits: PlanLimits;
}

export function unauthorizedResponse(route: string): NextResponse {
  logPlanEnforcement({ event: "unauthenticated", route, status: 401 });
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

export function forbiddenResponse(
  route: string,
  message: string,
  plan?: UserPlan,
): NextResponse {
  logPlanEnforcement({
    event: "plan_restriction",
    route,
    plan,
    reason: message,
    status: 403,
  });
  return NextResponse.json({ error: message, code: "plan_restricted" }, { status: 403 });
}

export function limitReachedResponse(
  route: string,
  message: string,
  details: { usageCount: number; limit: number; remaining: number; resetAt: string },
): NextResponse {
  logPlanEnforcement({
    event: "usage_limit",
    route,
    reason: message,
    status: 429,
  });
  return NextResponse.json(
    {
      error: message,
      code: "usage_limit_reached",
      usageCount: details.usageCount,
      limit: details.limit,
      remaining: details.remaining,
      resetAt: details.resetAt,
    },
    { status: 429 },
  );
}

/** Load authenticated user + effective plan from Supabase — never trust client plan. */
export async function requireAuthenticatedPlan(
  route: string,
): Promise<AuthenticatedPlanContext | NextResponse> {
  const user = await getAuthUser();
  if (!user) {
    return unauthorizedResponse(route);
  }

  if (!isAccountActive(user.profile)) {
    return forbiddenResponse(route, "Your account has been suspended.");
  }

  const plan = getEffectivePlan(user.profile);
  const limits = getPlanLimits(plan);

  return { user, plan, limits };
}

export async function requirePremiumAiPlan(
  route: string,
): Promise<AuthenticatedPlanContext | NextResponse> {
  const access = await requireAuthenticatedPlan(route);
  if (access instanceof NextResponse) {
    return access;
  }

  if (!access.limits.allowPremiumAi) {
    return forbiddenResponse(
      route,
      "Premium AI requires an active Pro or Business subscription.",
      access.plan,
    );
  }

  return access;
}

export async function require4KExportPlan(
  route: string,
): Promise<AuthenticatedPlanContext | NextResponse> {
  const access = await requireAuthenticatedPlan(route);
  if (access instanceof NextResponse) {
    return access;
  }

  if (!access.limits.allow4KExport) {
    return forbiddenResponse(
      route,
      "4K export requires an active Pro or Business subscription.",
      access.plan,
    );
  }

  return access;
}

/** Pro/Business security tools — never trust client isPro flags. */
export async function requireProUser(
  route: string,
): Promise<AuthenticatedPlanContext | NextResponse> {
  const access = await requireAuthenticatedPlan(route);
  if (access instanceof NextResponse) {
    return access;
  }

  if (!access.limits.allowSecurityTools) {
    return forbiddenResponse(
      route,
      "Security tools require an active Pro or Business subscription.",
      access.plan,
    );
  }

  return access;
}

export type ResolvedToolAccess =
  | { anonymous: true; limits: PlanLimits }
  | { anonymous: false; user: AuthUser; plan: UserPlan; limits: PlanLimits };

/** Resolve plan access for a tool — anonymous users may use free tools without auth. */
export async function resolveFreeToolAccess(
  route: string,
  toolId: string,
  fileSizeBytes?: number,
): Promise<ResolvedToolAccess | NextResponse> {
  const toolAccess = getToolAccess(toolId);
  if (!toolAccess) {
    return NextResponse.json({ error: "Unknown tool." }, { status: 400 });
  }

  if (toolAccess.requiresPremiumAi) {
    const premiumAccess = await requirePremiumAiPlan(route);
    if (premiumAccess instanceof NextResponse) {
      return premiumAccess;
    }
    return {
      anonymous: false,
      user: premiumAccess.user,
      plan: premiumAccess.plan,
      limits: premiumAccess.limits,
    };
  }

  if (toolAccess.requiresPro) {
    const proAccess = await requireProUser(route);
    if (proAccess instanceof NextResponse) {
      return proAccess;
    }
    return {
      anonymous: false,
      user: proAccess.user,
      plan: proAccess.plan,
      limits: proAccess.limits,
    };
  }

  const user = await getAuthUser();
  if (!user) {
    const limits = getPlanLimits("free");
    const uploadError = validateUploadSize(route, fileSizeBytes, limits);
    if (uploadError) {
      return uploadError;
    }
    return { anonymous: true, limits };
  }

  if (!isAccountActive(user.profile)) {
    return forbiddenResponse(route, "Your account has been suspended.");
  }

  const plan = getEffectivePlan(user.profile);
  const limits = getPlanLimits(plan);
  const uploadError = validateUploadSize(route, fileSizeBytes, limits);
  if (uploadError) {
    return uploadError;
  }

  return { anonymous: false, user, plan, limits };
}

export function validateUploadSize(
  route: string,
  fileSizeBytes: number | undefined,
  limits: PlanLimits,
): NextResponse | null {
  if (fileSizeBytes === undefined || fileSizeBytes <= 0) {
    return null;
  }

  if (fileSizeBytes > limits.maxUploadBytes) {
    return forbiddenResponse(
      route,
      `File exceeds the ${limits.plan} plan upload limit.`,
      limits.plan,
    );
  }

  return null;
}
