/**
 * Phase 130D-2C — website monitor *create* funnel analytics.
 * Durable Pro config action — not tool_process_* lifecycle semantics.
 * Never includes target URL, monitor IDs, or raw errors. Background checks must not use this.
 */

import type {
  MonitorFrequencyAnalytics,
  PlanGate,
  ToolErrorCode,
} from "@/lib/analytics/events";
import { MONITOR_FREQUENCIES } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/ga4";
import {
  ANALYTICS_SURFACES,
  type AnalyticsSurface,
} from "@/lib/analytics/surfaces";

const MONITOR_CREATE_SURFACES = new Set<string>([
  ANALYTICS_SURFACES.MONITOR_LIST,
  ANALYTICS_SURFACES.MONITOR_SCAN_REPORT,
]);

/** Website monitoring is Pro-gated at the API; product funnel always reports pro. */
const MONITOR_CREATE_PLAN_GATE: PlanGate = "pro";

export interface MonitorCreateAttemptInput {
  frequency: string;
  source_surface: AnalyticsSurface | string;
}

export interface MonitorCreateAttempt {
  /** Emits monitor_create_start once; returns false if already started. */
  markStarted(): boolean;
  /** Terminal success — only after markStarted(). */
  success(): void;
  /** Terminal error — only after markStarted(). */
  error(errorCode: ToolErrorCode): void;
}

function assertFrequency(value: string): MonitorFrequencyAnalytics | null {
  return (MONITOR_FREQUENCIES as readonly string[]).includes(value)
    ? (value as MonitorFrequencyAnalytics)
    : null;
}

function assertMonitorCreateSurface(value: string): string | null {
  return MONITOR_CREATE_SURFACES.has(value) ? value : null;
}

/**
 * In-memory create-attempt tracker for one user submit.
 * Attempt state is never sent to GA4 and never persisted.
 */
export function createMonitorCreateAttempt(
  input: MonitorCreateAttemptInput,
): MonitorCreateAttempt | null {
  const frequency = assertFrequency(input.frequency);
  const source_surface = assertMonitorCreateSurface(input.source_surface);
  if (!frequency || !source_surface) {
    return null;
  }

  let started = false;
  let terminal = false;

  const baseParams = {
    frequency,
    source_surface,
    plan_gate: MONITOR_CREATE_PLAN_GATE,
  };

  const emit = (fn: () => void) => {
    try {
      fn();
    } catch {
      // Analytics must never affect monitor creation.
    }
  };

  return {
    markStarted(): boolean {
      if (started) {
        return false;
      }
      started = true;
      emit(() => {
        trackEvent("monitor_create_start", { ...baseParams });
      });
      return true;
    },
    success(): void {
      if (!started || terminal) {
        return;
      }
      terminal = true;
      emit(() => {
        trackEvent("monitor_create_success", { ...baseParams });
      });
    },
    error(errorCode: ToolErrorCode): void {
      if (!started || terminal) {
        return;
      }
      terminal = true;
      emit(() => {
        trackEvent("monitor_create_error", {
          ...baseParams,
          error_code: errorCode,
        });
      });
    },
  };
}

/** Maps monitor create HTTP failures to allowlisted error codes (no raw messages). */
export function mapMonitorCreateHttpError(
  status: number,
  code?: string,
): ToolErrorCode {
  if (status === 401) {
    return "auth_required";
  }
  if (code === "plan_restricted" || code === "usage_limit_reached") {
    return "usage_limit";
  }
  if (status === 403) {
    return code === "plan_restricted" ? "usage_limit" : "auth_required";
  }
  if (status === 400 || status === 409 || status === 422) {
    return "validation";
  }
  if (status === 429) {
    return "usage_limit";
  }
  if (status === 502 || status === 503 || status >= 500) {
    return "provider";
  }
  return "unknown";
}
