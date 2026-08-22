import { getPrimaryCategory, NAV_ONLY_TOOL_CATEGORIES } from "@/constants/tool-categories";
import type {
  ProcessingType,
  PlanGate,
  ToolCategory,
  ToolErrorCode,
} from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/ga4";
import { getToolAccess } from "@/lib/plan/tool-access";

export interface ToolProcessMeta {
  tool_slug: string;
  tool_category: ToolCategory;
  processing_type: ProcessingType;
  plan_gate: PlanGate;
}

export interface ProcessAttempt {
  /** Emits tool_process_start once; returns false if already started (Strict Mode guard). */
  markStarted(): boolean;
  /** Terminal success — only after markStarted(). */
  success(outputCount: number): void;
  /** Terminal error — only after markStarted(). */
  error(errorCode: ToolErrorCode): void;
}

export function resolveToolProcessMeta(toolSlug: string): ToolProcessMeta | null {
  const access = getToolAccess(toolSlug);
  const category =
    getPrimaryCategory(toolSlug) ?? NAV_ONLY_TOOL_CATEGORIES[toolSlug];
  if (!access || !category) {
    return null;
  }

  let plan_gate: PlanGate = "free";
  if (access.requiresPremiumAi) {
    plan_gate = "premium_ai";
  } else if (access.requiresPro) {
    plan_gate = "pro";
  }

  return {
    tool_slug: toolSlug,
    tool_category: category as ToolCategory,
    processing_type: access.processing,
    plan_gate,
  };
}

/**
 * Creates an in-memory processing attempt tracker for one user action.
 * Attempt state is never sent to GA4 and never persisted.
 */
export function createProcessAttempt(toolSlug: string): ProcessAttempt | null {
  const meta = resolveToolProcessMeta(toolSlug);
  if (!meta) {
    return null;
  }

  let started = false;
  let terminal = false;

  const baseParams = {
    tool_slug: meta.tool_slug,
    tool_category: meta.tool_category,
    processing_type: meta.processing_type,
  };

  const emit = (fn: () => void) => {
    try {
      fn();
    } catch {
      // Analytics must never affect tool operation.
    }
  };

  return {
    markStarted(): boolean {
      if (started) {
        return false;
      }
      started = true;
      emit(() => {
        trackEvent("tool_process_start", {
          ...baseParams,
          plan_gate: meta.plan_gate,
        });
      });
      return true;
    },
    success(outputCount: number): void {
      if (!started || terminal) {
        return;
      }
      if (!Number.isInteger(outputCount) || outputCount < 1 || outputCount > 999) {
        return;
      }
      terminal = true;
      emit(() => {
        trackEvent("tool_process_success", {
          ...baseParams,
          output_count: outputCount,
        });
      });
    },
    error(errorCode: ToolErrorCode): void {
      if (!started || terminal) {
        return;
      }
      terminal = true;
      emit(() => {
        trackEvent("tool_process_error", {
          ...baseParams,
          error_code: errorCode,
        });
      });
    },
  };
}

/** Maps plan-gate HTTP failures to allowlisted error codes (pre-start — do not emit). */
export function httpStatusToErrorCode(status: number, code?: string): ToolErrorCode {
  if (status === 401) {
    return "auth_required";
  }
  if (code === "usage_limit_reached" || (status === 403 && code === "usage_limit_reached")) {
    return "usage_limit";
  }
  if (status === 403) {
    return "auth_required";
  }
  if (status === 400 || status === 422) {
    return "validation";
  }
  if (status === 502 || status === 503) {
    return "provider";
  }
  if (status >= 500) {
    return "provider";
  }
  return "unknown";
}

/** Maps user-facing plan/API messages to allowlisted error codes. */
export function planErrorMessageToCode(message: string): ToolErrorCode {
  if (/sign in/i.test(message)) {
    return "auth_required";
  }
  if (/limit reached/i.test(message)) {
    return "usage_limit";
  }
  if (/upgrade/i.test(message)) {
    return "auth_required";
  }
  if (
    /password|invalid|unsupported|must be|enter |required|not supported|too large|exceeds/i.test(
      message,
    )
  ) {
    return "validation";
  }
  if (/unavailable|provider|service/i.test(message)) {
    return "provider";
  }
  return "unknown";
}
