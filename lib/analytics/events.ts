/**
 * Phase 130D Step 2A + Phase 130E — GA4 custom event schema.
 * Authoritative allowlists; product call sites use trackEvent() only.
 */

import { FROZEN_130D_CUSTOM_EVENT_NAMES } from "@/lib/analytics/surfaces";

/** Approved custom event names (8). */
export const CUSTOM_EVENT_NAMES = [
  ...FROZEN_130D_CUSTOM_EVENT_NAMES,
  "subscription_complete",
] as const;

export type CustomEventName = (typeof CUSTOM_EVENT_NAMES)[number];

export const TOOL_CATEGORIES = ["pdf", "image", "ai", "security"] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const PROCESSING_TYPES = ["client", "server"] as const;
export type ProcessingType = (typeof PROCESSING_TYPES)[number];

export const PLAN_GATES = ["free", "pro", "premium_ai"] as const;
export type PlanGate = (typeof PLAN_GATES)[number];

export const ERROR_CODES = [
  "usage_limit",
  "auth_required",
  "validation",
  "network",
  "provider",
  "unknown",
] as const;
export type ToolErrorCode = (typeof ERROR_CODES)[number];

export const DOWNLOAD_TYPES = ["single", "zip"] as const;
export type DownloadType = (typeof DOWNLOAD_TYPES)[number];

export const BILLING_TIERS = ["pro", "business", "free", "unknown"] as const;
export type BillingTier = (typeof BILLING_TIERS)[number];

export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingIntervalValue = (typeof BILLING_INTERVALS)[number];

/** subscription_complete tier allowlist (paid plans only). */
export const SUBSCRIPTION_COMPLETE_TIERS = ["pro", "business"] as const;
export type SubscriptionCompleteTier = (typeof SUBSCRIPTION_COMPLETE_TIERS)[number];

/** Required parameter keys per event. */
export const EVENT_REQUIRED_PARAMETERS: Record<CustomEventName, readonly string[]> = {
  tool_process_start: ["tool_slug", "tool_category", "processing_type", "plan_gate"],
  tool_process_success: ["tool_slug", "tool_category", "processing_type", "output_count"],
  tool_process_error: ["tool_slug", "tool_category", "processing_type", "error_code"],
  tool_download: ["tool_slug", "tool_category", "output_count", "download_type"],
  upgrade_click: ["source_surface", "tier"],
  checkout_start: ["tier", "billing_interval", "source_surface"],
  find_tool_search: ["query_length", "result_count", "source_surface"],
  subscription_complete: ["tier", "billing_interval", "source_surface"],
};

/** Optional parameter keys per event. */
export const EVENT_OPTIONAL_PARAMETERS: Record<CustomEventName, readonly string[]> = {
  tool_process_start: [],
  tool_process_success: [],
  tool_process_error: [],
  tool_download: [],
  upgrade_click: ["tool_slug"],
  checkout_start: [],
  find_tool_search: [],
  subscription_complete: [],
};

/** Full parameter allowlist per event (required + optional). */
export const EVENT_PARAMETER_ALLOWLIST: Record<CustomEventName, readonly string[]> = {
  tool_process_start: EVENT_REQUIRED_PARAMETERS.tool_process_start,
  tool_process_success: EVENT_REQUIRED_PARAMETERS.tool_process_success,
  tool_process_error: EVENT_REQUIRED_PARAMETERS.tool_process_error,
  tool_download: EVENT_REQUIRED_PARAMETERS.tool_download,
  upgrade_click: [...EVENT_REQUIRED_PARAMETERS.upgrade_click, ...EVENT_OPTIONAL_PARAMETERS.upgrade_click],
  checkout_start: EVENT_REQUIRED_PARAMETERS.checkout_start,
  find_tool_search: EVENT_REQUIRED_PARAMETERS.find_tool_search,
  subscription_complete: EVENT_REQUIRED_PARAMETERS.subscription_complete,
};

/** Keys that must never reach GA4 (global blocklist). */
export const FORBIDDEN_PARAMETER_NAMES = [
  "filename",
  "original_filename",
  "file_name",
  "file_size",
  "file_size_bytes",
  "mime_type",
  "file_type",
  "file_contents",
  "document_text",
  "ocr_text",
  "ai_prompt",
  "ai_output",
  "translated_text",
  "qr_content",
  "query",
  "search_query",
  "raw_query",
  "email",
  "user_id",
  "userId",
  "supabase_id",
  "stripe_id",
  "stripe_customer_id",
  "stripe_subscription_id",
  "stripe_session_id",
  "subscription_id",
  "transaction_id",
  "payment_method",
  "amount",
  "currency",
  "period_end",
  "subscription_period_end",
  "subscriptionPeriodEnd",
  "session_id",
  "auth_token",
  "access_token",
  "password",
  "error_message",
  "errorMessage",
  "stack",
  "stack_trace",
  "api_response",
  "page_location",
  "page_url",
  "url",
  "blob_url",
  "href",
  "user_properties",
  "user_id",
] as const;

export interface ToolProcessStartParams {
  tool_slug: string;
  tool_category: ToolCategory;
  processing_type: ProcessingType;
  plan_gate: PlanGate;
}

export interface ToolProcessSuccessParams {
  tool_slug: string;
  tool_category: ToolCategory;
  processing_type: ProcessingType;
  output_count: number;
}

export interface ToolProcessErrorParams {
  tool_slug: string;
  tool_category: ToolCategory;
  processing_type: ProcessingType;
  error_code: ToolErrorCode;
}

export interface ToolDownloadParams {
  tool_slug: string;
  tool_category: ToolCategory;
  output_count: number;
  download_type: DownloadType;
}

export interface UpgradeClickParams {
  source_surface: string;
  tier: BillingTier;
  tool_slug?: string;
}

export interface CheckoutStartParams {
  tier: BillingTier;
  billing_interval: BillingIntervalValue;
  source_surface: string;
}

export interface FindToolSearchParams {
  query_length: number;
  result_count: number;
  source_surface: string;
}

export interface SubscriptionCompleteParams {
  tier: SubscriptionCompleteTier;
  billing_interval: BillingIntervalValue;
  source_surface: string;
}

export interface CustomEventParamsMap {
  tool_process_start: ToolProcessStartParams;
  tool_process_success: ToolProcessSuccessParams;
  tool_process_error: ToolProcessErrorParams;
  tool_download: ToolDownloadParams;
  upgrade_click: UpgradeClickParams;
  checkout_start: CheckoutStartParams;
  find_tool_search: FindToolSearchParams;
  subscription_complete: SubscriptionCompleteParams;
}

import {
  ANALYTICS_SOURCE_SURFACE_UNKNOWN,
  ANALYTICS_SURFACES,
} from "@/lib/analytics/surfaces";

const APPROVED_SOURCE_SURFACES = new Set<string>([
  ...Object.values(ANALYTICS_SURFACES),
  ANALYTICS_SOURCE_SURFACE_UNKNOWN,
]);

function isForbiddenParameterName(key: string): boolean {
  const lower = key.toLowerCase();
  if (FORBIDDEN_PARAMETER_NAMES.some((blocked) => blocked.toLowerCase() === lower)) {
    return true;
  }
  if (lower.includes("filename") || lower.includes("file_name")) return true;
  if (lower.includes("file_size")) return true;
  if (lower.includes("email")) return true;
  if (lower.includes("token") || lower.includes("password")) return true;
  if (lower.includes("user_id") || lower.includes("userid")) return true;
  if (lower.endsWith("_url") || lower.includes("http")) return true;
  return false;
}

function isCustomEventName(value: string): value is CustomEventName {
  return (CUSTOM_EVENT_NAMES as readonly string[]).includes(value);
}

function assertToolSlug(value: unknown): string | null {
  if (typeof value !== "string" || !TOOL_SLUG_PATTERN.test(value)) return null;
  return value;
}

const TOOL_SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

function assertApprovedSourceSurface(value: unknown): string | null {
  if (typeof value !== "string" || !APPROVED_SOURCE_SURFACES.has(value)) return null;
  return value;
}

function assertSourceSurface(value: unknown): string | null {
  if (typeof value !== "string" || !/^[a-z0-9_]{1,64}$/.test(value)) return null;
  return value;
}

function assertEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function assertCount(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    return null;
  }
  return value;
}

export type SanitizeCustomEventResult =
  | { ok: true; eventName: CustomEventName; params: Record<string, string | number> }
  | { ok: false; reason: string };

/**
 * Validates and sanitizes a custom GA4 event payload.
 * Drops unknown/forbidden keys; rejects invalid enum/shape values.
 */
export function sanitizeCustomEvent<E extends CustomEventName>(
  eventName: E,
  rawParameters: CustomEventParamsMap[E],
): SanitizeCustomEventResult {
  if (!isCustomEventName(eventName)) {
    return { ok: false, reason: "unknown_event" };
  }

  if (rawParameters === null || typeof rawParameters !== "object") {
    return { ok: false, reason: "invalid_parameters" };
  }

  const entries = Object.entries(rawParameters as unknown as Record<string, unknown>);
  const allowedKeys = EVENT_PARAMETER_ALLOWLIST[eventName];
  const requiredKeys = EVENT_REQUIRED_PARAMETERS[eventName];

  for (const [key] of entries) {
    if (isForbiddenParameterName(key)) {
      return { ok: false, reason: `forbidden_parameter:${key}` };
    }
    if (!allowedKeys.includes(key)) {
      return { ok: false, reason: `unknown_parameter:${key}` };
    }
  }

  for (const key of requiredKeys) {
    if (!(key in (rawParameters as object))) {
      return { ok: false, reason: `missing_parameter:${key}` };
    }
  }

  switch (eventName) {
    case "tool_process_start": {
      const p = rawParameters as ToolProcessStartParams;
      const tool_slug = assertToolSlug(p.tool_slug);
      const tool_category = assertEnum(p.tool_category, TOOL_CATEGORIES);
      const processing_type = assertEnum(p.processing_type, PROCESSING_TYPES);
      const plan_gate = assertEnum(p.plan_gate, PLAN_GATES);
      if (!tool_slug || !tool_category || !processing_type || !plan_gate) {
        return { ok: false, reason: "invalid_tool_process_start" };
      }
      return {
        ok: true,
        eventName,
        params: { tool_slug, tool_category, processing_type, plan_gate },
      };
    }
    case "tool_process_success": {
      const p = rawParameters as ToolProcessSuccessParams;
      const tool_slug = assertToolSlug(p.tool_slug);
      const tool_category = assertEnum(p.tool_category, TOOL_CATEGORIES);
      const processing_type = assertEnum(p.processing_type, PROCESSING_TYPES);
      const output_count = assertCount(p.output_count, 1, 999);
      if (!tool_slug || !tool_category || !processing_type || output_count === null) {
        return { ok: false, reason: "invalid_tool_process_success" };
      }
      return {
        ok: true,
        eventName,
        params: { tool_slug, tool_category, processing_type, output_count },
      };
    }
    case "tool_process_error": {
      const p = rawParameters as ToolProcessErrorParams;
      const tool_slug = assertToolSlug(p.tool_slug);
      const tool_category = assertEnum(p.tool_category, TOOL_CATEGORIES);
      const processing_type = assertEnum(p.processing_type, PROCESSING_TYPES);
      const error_code = assertEnum(p.error_code, ERROR_CODES);
      if (!tool_slug || !tool_category || !processing_type || !error_code) {
        return { ok: false, reason: "invalid_tool_process_error" };
      }
      return {
        ok: true,
        eventName,
        params: { tool_slug, tool_category, processing_type, error_code },
      };
    }
    case "tool_download": {
      const p = rawParameters as ToolDownloadParams;
      const tool_slug = assertToolSlug(p.tool_slug);
      const tool_category = assertEnum(p.tool_category, TOOL_CATEGORIES);
      const output_count = assertCount(p.output_count, 1, 999);
      const download_type = assertEnum(p.download_type, DOWNLOAD_TYPES);
      if (!tool_slug || !tool_category || output_count === null || !download_type) {
        return { ok: false, reason: "invalid_tool_download" };
      }
      return {
        ok: true,
        eventName,
        params: { tool_slug, tool_category, output_count, download_type },
      };
    }
    case "upgrade_click": {
      const p = rawParameters as UpgradeClickParams;
      const source_surface = assertSourceSurface(p.source_surface);
      const tier = assertEnum(p.tier, BILLING_TIERS);
      if (!source_surface || !tier) {
        return { ok: false, reason: "invalid_upgrade_click" };
      }
      const params: Record<string, string | number> = { source_surface, tier };
      if (p.tool_slug !== undefined) {
        const tool_slug = assertToolSlug(p.tool_slug);
        if (!tool_slug) return { ok: false, reason: "invalid_upgrade_click_tool_slug" };
        params.tool_slug = tool_slug;
      }
      return { ok: true, eventName, params };
    }
    case "checkout_start": {
      const p = rawParameters as CheckoutStartParams;
      const tier = assertEnum(p.tier, BILLING_TIERS);
      const billing_interval = assertEnum(p.billing_interval, BILLING_INTERVALS);
      const source_surface = assertSourceSurface(p.source_surface);
      if (!tier || !billing_interval || !source_surface) {
        return { ok: false, reason: "invalid_checkout_start" };
      }
      return {
        ok: true,
        eventName,
        params: { tier, billing_interval, source_surface },
      };
    }
    case "find_tool_search": {
      const p = rawParameters as FindToolSearchParams;
      const query_length = assertCount(p.query_length, 0, 500);
      const result_count = assertCount(p.result_count, 0, 100);
      const source_surface = assertSourceSurface(p.source_surface);
      if (query_length === null || result_count === null || !source_surface) {
        return { ok: false, reason: "invalid_find_tool_search" };
      }
      return {
        ok: true,
        eventName,
        params: { query_length, result_count, source_surface },
      };
    }
    case "subscription_complete": {
      const p = rawParameters as SubscriptionCompleteParams;
      const tier = assertEnum(p.tier, SUBSCRIPTION_COMPLETE_TIERS);
      const billing_interval = assertEnum(p.billing_interval, BILLING_INTERVALS);
      const source_surface = assertApprovedSourceSurface(p.source_surface);
      if (!tier || !billing_interval || !source_surface) {
        return { ok: false, reason: "invalid_subscription_complete" };
      }
      return {
        ok: true,
        eventName,
        params: { tier, billing_interval, source_surface },
      };
    }
    default:
      return { ok: false, reason: "unsupported_event" };
  }
}

export function isKnownCustomEventName(value: string): value is CustomEventName {
  return isCustomEventName(value);
}
