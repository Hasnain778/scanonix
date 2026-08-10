import { env } from "@/config/env";
import { publicEnv } from "@/config/env.public";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";

/** Server-side auth callback URL (emailRedirectTo, resend, etc.). */
export function buildAuthCallbackUrl(next = "/dashboard"): string {
  const safeNext = getSafeRedirectPath(next);
  return `${env.siteUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}

/** Browser-side auth callback URL. */
export function buildAuthCallbackUrlClient(next = "/dashboard"): string {
  const safeNext = getSafeRedirectPath(next);
  return `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}
