import { NextResponse } from "next/server";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

export interface RateLimitOptions {
  /** Unique key prefix (route name). */
  route: string;
  /** Client identifier (IP or user id). */
  identifier: string;
  /** Max requests per window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function checkRateLimit(options: RateLimitOptions): {
  allowed: boolean;
  remaining: number;
  retryAfterSec?: number;
} {
  const key = `${options.route}:${options.identifier}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1 };
  }

  if (existing.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: options.limit - existing.count };
}

export function rateLimitResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please try again later.", code: "rate_limited" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

/** Apply IP-based rate limit; returns a 429 response or null if allowed. */
export function enforceRateLimit(
  request: Request,
  options: Omit<RateLimitOptions, "identifier"> & { identifier?: string },
): NextResponse | null {
  const identifier = options.identifier ?? getClientIp(request);
  const result = checkRateLimit({ ...options, identifier });
  if (!result.allowed) {
    return rateLimitResponse(result.retryAfterSec ?? 60);
  }
  return null;
}
