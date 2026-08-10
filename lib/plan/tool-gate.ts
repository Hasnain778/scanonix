import {
  getToolAccess,
  validateAnonymousUploadSize,
} from "@/lib/plan/tool-access";

export type ToolGateResult =
  | { ok: true; remaining: number; resetAt?: string }
  | { ok: false; message: string; code?: string; status: number };

interface PlanErrorBody {
  error?: string;
  code?: string;
}

export function formatPlanError(
  data: PlanErrorBody,
  status: number,
): string {
  if (status === 401) {
    return "Please sign in to use this tool.";
  }

  if (data.code === "usage_limit_reached") {
    return "Limit reached — upgrade your plan or wait until your usage resets.";
  }

  if (data.code === "plan_restricted") {
    return data.error ?? "Upgrade required for this feature.";
  }

  return data.error ?? "Could not authorize this operation.";
}

async function consumeToolUsageViaApi(
  tool: string,
  fileSizeBytes?: number,
): Promise<ToolGateResult> {
  const response = await fetch("/api/usage/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, fileSizeBytes }),
  });

  const data = (await response.json()) as PlanErrorBody & {
    remaining?: number;
    resetAt?: string;
  };

  if (!response.ok) {
    return {
      ok: false,
      message: formatPlanError(data, response.status),
      code: data.code,
      status: response.status,
    };
  }

  return {
    ok: true,
    remaining: data.remaining ?? 0,
    resetAt: data.resetAt,
  };
}

export async function gateToolOperation(
  tool: string,
  fileSizeBytes?: number,
): Promise<ToolGateResult> {
  const access = getToolAccess(tool);
  if (!access) {
    return {
      ok: false,
      message: "Unknown tool.",
      status: 400,
    };
  }

  if (access.requiresPro || access.requiresPremiumAi) {
    return consumeToolUsageViaApi(tool, fileSizeBytes);
  }

  const sizeError = validateAnonymousUploadSize(tool, fileSizeBytes);
  if (sizeError) {
    return {
      ok: false,
      message: sizeError,
      code: "plan_restricted",
      status: 403,
    };
  }

  try {
    const response = await fetch("/api/usage/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, fileSizeBytes }),
    });

    if (response.status === 401) {
      return { ok: true, remaining: -1 };
    }

    const data = (await response.json()) as PlanErrorBody & {
      remaining?: number;
      resetAt?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        message: formatPlanError(data, response.status),
        code: data.code,
        status: response.status,
      };
    }

    return {
      ok: true,
      remaining: data.remaining ?? 0,
      resetAt: data.resetAt,
    };
  } catch {
    return { ok: true, remaining: -1 };
  }
}

export async function authorizeBackgroundExport(
  resolution: "hd" | "4k",
  fileSizeBytes?: number,
): Promise<
  | { ok: true; allowedResolution: "hd" | "4k" }
  | { ok: false; message: string; status: number }
> {
  if (resolution === "hd") {
    const sizeError = validateAnonymousUploadSize("background-remover", fileSizeBytes);
    if (sizeError) {
      return {
        ok: false,
        message: sizeError,
        status: 403,
      };
    }

    return { ok: true, allowedResolution: "hd" };
  }

  const response = await fetch("/api/tools/background-remover/authorize-export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolution, fileSizeBytes }),
  });

  const data = (await response.json()) as PlanErrorBody & {
    allowedResolution?: "hd" | "4k";
  };

  if (!response.ok) {
    return {
      ok: false,
      message: formatPlanError(data, response.status),
      status: response.status,
    };
  }

  return {
    ok: true,
    allowedResolution: data.allowedResolution ?? "4k",
  };
}
