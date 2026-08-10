import { buildAuthCallbackUrl, buildAuthCallbackUrlClient } from "@/lib/auth/callback-url";

export const RESET_PASSWORD_PATH = "/auth/reset-password";

/** Supabase resetPasswordForEmail redirect — exchanges PKCE code in /auth/callback. */
export function buildResetPasswordRedirectUrl(): string {
  return buildAuthCallbackUrl(RESET_PASSWORD_PATH);
}

/** Browser-side resetPasswordForEmail redirect. */
export function buildResetPasswordRedirectUrlClient(): string {
  return buildAuthCallbackUrlClient(RESET_PASSWORD_PATH);
}

export function buildRecoveryCallbackUrl(origin: string, code: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("code", code);
  url.searchParams.set("next", RESET_PASSWORD_PATH);
  return url.toString();
}
