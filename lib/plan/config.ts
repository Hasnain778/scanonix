import type { UserPlan } from "@/types/auth";
import { FILE_LIMITS } from "@/lib/scan/file/constants";

export type UsagePeriod = "day" | "month";

export interface PlanLimits {
  plan: UserPlan;
  toolOperationsPerPeriod: number;
  usagePeriod: UsagePeriod;
  maxUploadBytes: number;
  allow4KExport: boolean;
  allowPremiumAi: boolean;
  allowSecurityTools: boolean;
  priorityProcessing: boolean;
}

export const TOOL_OPERATION_ACTION = "tool_operation";

export const PLAN_LIMITS: Record<UserPlan, PlanLimits> = {
  free: {
    plan: "free",
    toolOperationsPerPeriod: 10,
    usagePeriod: "day",
    maxUploadBytes: 10 * 1024 * 1024,
    allow4KExport: false,
    allowPremiumAi: false,
    allowSecurityTools: false,
    priorityProcessing: false,
  },
  pro: {
    plan: "pro",
    toolOperationsPerPeriod: 500,
    usagePeriod: "month",
    maxUploadBytes: 50 * 1024 * 1024,
    allow4KExport: true,
    allowPremiumAi: true,
    allowSecurityTools: true,
    priorityProcessing: false,
  },
  business: {
    plan: "business",
    toolOperationsPerPeriod: 2500,
    usagePeriod: "month",
    maxUploadBytes: 100 * 1024 * 1024,
    allow4KExport: true,
    allowPremiumAi: true,
    allowSecurityTools: true,
    priorityProcessing: true,
  },
};

export function getPlanLimits(plan: UserPlan): PlanLimits {
  const limits = PLAN_LIMITS[plan];
  return {
    ...limits,
    maxUploadBytes: Math.min(limits.maxUploadBytes, FILE_LIMITS.maxAnalysisBytes),
  };
}
