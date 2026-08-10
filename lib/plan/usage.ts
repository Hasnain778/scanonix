import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPlanLimits,
  TOOL_OPERATION_ACTION,
  type PlanLimits,
} from "@/lib/plan/config";
import { logPlanEnforcement } from "@/lib/plan/logger";
import { getUsagePeriodWindow } from "@/lib/plan/periods";
import type { UserPlan } from "@/types/auth";

export interface UsageSummary {
  plan: UserPlan;
  action: string;
  usageCount: number;
  limit: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
  resetAt: string;
  priorityProcessing: boolean;
  maxUploadBytes: number;
  allow4KExport: boolean;
  allowPremiumAi: boolean;
}

export interface ConsumeUsageResult {
  allowed: boolean;
  usageCount: number;
  limit: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
  resetAt: string;
}

interface RpcConsumeResult {
  allowed: boolean;
  usage_count: number;
  limit: number;
  remaining: number;
}

function getLimitsForPlan(plan: UserPlan): PlanLimits {
  return getPlanLimits(plan);
}

export async function getUsageSummary(
  userId: string,
  plan: UserPlan,
  action: string = TOOL_OPERATION_ACTION,
): Promise<UsageSummary> {
  const limits = getLimitsForPlan(plan);
  const { periodStart, periodEnd } = getUsagePeriodWindow(limits.usagePeriod);

  const admin = createAdminClient();
  const { data } = await admin
    .from("usage_counters")
    .select("usage_count")
    .eq("user_id", userId)
    .eq("action", action)
    .eq("period_start", periodStart.toISOString())
    .maybeSingle();

  const usageCount = data?.usage_count ?? 0;
  const limit = limits.toolOperationsPerPeriod;
  const remaining = Math.max(limit - usageCount, 0);

  return {
    plan,
    action,
    usageCount,
    limit,
    remaining,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    resetAt: periodEnd.toISOString(),
    priorityProcessing: limits.priorityProcessing,
    maxUploadBytes: limits.maxUploadBytes,
    allow4KExport: limits.allow4KExport,
    allowPremiumAi: limits.allowPremiumAi,
  };
}

export async function consumeUsage(
  userId: string,
  plan: UserPlan,
  action: string = TOOL_OPERATION_ACTION,
): Promise<ConsumeUsageResult> {
  const limits = getLimitsForPlan(plan);
  const { periodStart, periodEnd } = getUsagePeriodWindow(limits.usagePeriod);
  const limit = limits.toolOperationsPerPeriod;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_tool_usage", {
    p_user_id: userId,
    p_action: action,
    p_period_start: periodStart.toISOString(),
    p_period_end: periodEnd.toISOString(),
    p_limit: limit,
  });

  if (error) {
    logPlanEnforcement({
      event: "usage_increment_failure",
      action,
      reason: error.message,
    });
    throw new Error(`Usage increment failed: ${error.message}`);
  }

  const result = data as RpcConsumeResult;

  return {
    allowed: Boolean(result.allowed),
    usageCount: result.usage_count ?? 0,
    limit: result.limit ?? limit,
    remaining: result.remaining ?? 0,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    resetAt: periodEnd.toISOString(),
  };
}
