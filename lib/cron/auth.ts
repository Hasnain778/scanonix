import { env } from "@/config/env";

/** True when running `next dev` (local development). */
export function isDevelopmentEnvironment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Verifies cron endpoint access.
 * - Development: always allowed (no secret required).
 * - Production: requires CRON_SECRET via Authorization Bearer or x-cron-secret header.
 */
export function verifyCronSecret(request: Request): boolean {
  if (isDevelopmentEnvironment()) {
    return true;
  }

  const secret = env.cronSecret;
  if (!secret) {
    console.error(
      "[cron] CRON_SECRET is not configured. Set it in Vercel Environment Variables for production.",
    );
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) {
    return true;
  }

  return request.headers.get("x-cron-secret") === secret;
}
