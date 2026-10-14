import { logPlanEnforcement } from "@/lib/plan/logger";
import { TOOL_OPERATION_ACTION } from "@/lib/plan/config";
import {
  commitUsageReservation,
  releaseUsageReservation,
  reserveUsage,
  type ConsumeUsageResult,
  type ReserveUsageResult,
} from "@/lib/plan/usage";
import type { UserPlan } from "@/types/auth";

export type ReservedUsage<T> =
  | { status: "denied"; usage: ConsumeUsageResult }
  | { status: "ok"; value: T; usage: ConsumeUsageResult };

/**
 * Reserves one shared tool operation, runs the provider, then commits.
 * Provider failures release the reservation. An uncertain commit does not.
 */
export async function runWithReservedUsage<T>(options: {
  userId: string;
  plan: UserPlan;
  run: () => Promise<T>;
}): Promise<ReservedUsage<T>> {
  const reserved: ReserveUsageResult = await reserveUsage(options.userId, options.plan);

  if (!reserved.allowed || !reserved.reservationId) {
    return { status: "denied", usage: reserved };
  }

  const reservationId = reserved.reservationId;
  let value: T;

  try {
    value = await options.run();
  } catch (error) {
    try {
      await releaseUsageReservation(reservationId);
    } catch {
      logPlanEnforcement({
        event: "usage_increment_failure",
        action: TOOL_OPERATION_ACTION,
        reason: "reservation_release_failed",
      });
    }
    throw error;
  }

  let outcome: Awaited<ReturnType<typeof commitUsageReservation>>;
  try {
    outcome = await commitUsageReservation(reservationId);
  } catch {
    logPlanEnforcement({
      event: "usage_increment_failure",
      action: TOOL_OPERATION_ACTION,
      reason: "reservation_commit_uncertain",
    });
    return { status: "ok", value, usage: reserved };
  }

  if (outcome === "already_released" || outcome === "not_found") {
    throw new Error("Usage reservation could not be committed.");
  }

  return { status: "ok", value, usage: reserved };
}
