export interface UsageSummaryResponse {
  plan: string;
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

export interface ConsumeUsageResponse {
  ok: boolean;
  remaining: number;
  resetAt: string;
  plan: string;
  usageCount: number;
  limit: number;
  priorityProcessing?: boolean;
}

export interface PlanErrorResponse {
  error: string;
  code?: string;
  remaining?: number;
  resetAt?: string;
  limit?: number;
  usageCount?: number;
}

export async function fetchUsageSummary(): Promise<UsageSummaryResponse | null> {
  const response = await fetch("/api/usage/summary", { cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  return (await response.json()) as UsageSummaryResponse;
}

export async function consumeToolUsage(
  tool: string,
  fileSizeBytes?: number,
): Promise<ConsumeUsageResponse | PlanErrorResponse> {
  const response = await fetch("/api/usage/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, fileSizeBytes }),
  });

  const data = (await response.json()) as ConsumeUsageResponse | PlanErrorResponse;
  if (!response.ok) {
    return data;
  }

  return data as ConsumeUsageResponse;
}

export function isPlanError(
  result: unknown,
): result is PlanErrorResponse {
  return Boolean(result && typeof result === "object" && "error" in result && !("ok" in result && (result as { ok?: boolean }).ok));
}
