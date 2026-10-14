import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanLimits } from "@/lib/plan/config";
import { getUsagePeriodWindow } from "@/lib/plan/periods";
import type { UserPlan } from "@/types/auth";

export interface UpscaleUsageSnapshot {
  usageCount: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

export type ChargeUpscaleJobResult =
  | {
      outcome: "charged" | "already_charged";
      allowed: true;
      usage: UpscaleUsageSnapshot;
    }
  | { outcome: "denied"; allowed: false; usage: UpscaleUsageSnapshot }
  | {
      outcome: "forbidden" | "not_found" | "not_chargeable" | "refunded";
      allowed: false;
    };

interface ChargeRpcRow {
  outcome?: string;
  allowed?: boolean;
  usage_count?: number | null;
  limit?: number | null;
  remaining?: number | null;
}

function usageSnapshot(
  row: ChargeRpcRow,
  limit: number,
  resetAt: string,
): UpscaleUsageSnapshot {
  return {
    usageCount: row.usage_count ?? 0,
    limit: row.limit ?? limit,
    remaining: row.remaining ?? 0,
    resetAt,
  };
}

export async function chargeUpscaleJob(
  userId: string,
  plan: UserPlan,
  jobId: string,
): Promise<ChargeUpscaleJobResult> {
  const limits = getPlanLimits(plan);
  const { periodStart, periodEnd } = getUsagePeriodWindow(limits.usagePeriod);
  const resetAt = periodEnd.toISOString();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("charge_upscale_job", {
    p_job_id: jobId,
    p_user_id: userId,
    p_period_start: periodStart.toISOString(),
    p_period_end: resetAt,
    p_limit: limits.toolOperationsPerPeriod,
  });

  if (error) {
    throw new Error("Usage charge failed.");
  }

  const row = (data ?? {}) as ChargeRpcRow;
  const usage = usageSnapshot(row, limits.toolOperationsPerPeriod, resetAt);

  if (row.outcome === "charged" || row.outcome === "already_charged") {
    return { outcome: row.outcome, allowed: true, usage };
  }

  if (row.outcome === "denied") {
    return { outcome: "denied", allowed: false, usage };
  }

  if (
    row.outcome === "forbidden" ||
    row.outcome === "not_found" ||
    row.outcome === "not_chargeable" ||
    row.outcome === "refunded"
  ) {
    return { outcome: row.outcome, allowed: false };
  }

  throw new Error("Usage charge failed.");
}

async function creditRpc(functionName: string, args: Record<string, string>): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(functionName, args);
  if (error) {
    throw new Error("Upscale credit update failed.");
  }

  const outcome = (data as { outcome?: string } | null)?.outcome;
  if (!outcome) {
    throw new Error("Upscale credit update failed.");
  }

  return outcome;
}

export async function failUpscaleJob(
  jobId: string,
  errorCode: string,
  errorMessage: string,
): Promise<string> {
  return creditRpc("fail_upscale_job", {
    p_job_id: jobId,
    p_error_code: errorCode,
    p_error_message: errorMessage,
  });
}

export async function closeUnchargedUpscaleJob(
  jobId: string,
  errorCode: string,
  errorMessage: string,
): Promise<string> {
  return creditRpc("close_uncharged_upscale_job", {
    p_job_id: jobId,
    p_error_code: errorCode,
    p_error_message: errorMessage,
  });
}

export async function recoverStaleUpscaleJobs(staleAfterSeconds = 600): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("recover_stale_upscale_jobs", {
    p_stale_after_seconds: staleAfterSeconds,
  });

  if (error) {
    throw new Error("Upscale recovery failed.");
  }

  return typeof data === "number" ? data : 0;
}
