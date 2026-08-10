type PlanLogEvent =
  | "unauthenticated"
  | "plan_restriction"
  | "usage_limit"
  | "usage_increment_failure";

interface PlanLogPayload {
  event: PlanLogEvent;
  route?: string;
  plan?: string;
  action?: string;
  reason?: string;
  status?: number;
}

/** Structured plan enforcement logs — no secrets, tokens, or personal data. */
export function logPlanEnforcement(payload: PlanLogPayload): void {
  console.warn(
    JSON.stringify({
      scope: "plan_enforcement",
      ...payload,
    }),
  );
}
