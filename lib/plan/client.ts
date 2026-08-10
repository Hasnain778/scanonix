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

export async function authorizeBackgroundRemoverExport(
  resolution: "hd" | "4k",
  fileSizeBytes?: number,
): Promise<{ ok: true; allowedResolution: "hd" | "4k"; remaining: number } | PlanErrorResponse> {
  const response = await fetch("/api/tools/background-remover/authorize-export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolution, fileSizeBytes }),
  });

  const data = await response.json();
  if (!response.ok) {
    return data as PlanErrorResponse;
  }

  return data as { ok: true; allowedResolution: "hd" | "4k"; remaining: number };
}

export function isPlanError(
  result: unknown,
): result is PlanErrorResponse {
  return Boolean(result && typeof result === "object" && "error" in result && !("ok" in result && (result as { ok?: boolean }).ok));
}
