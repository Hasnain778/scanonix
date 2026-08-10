import { RESET_PASSWORD_PATH } from "@/lib/auth/reset-password-url";

export type CallbackErrorCode =
  | "auth_callback_failed"
  | "expired_link"
  | "invalid_link"
  | "missing_code"
  | "pkce_required";

export function getCallbackErrorCode(
  error: { message?: string; code?: string } | null,
): CallbackErrorCode {
  const message = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();

  if (
    message.includes("code verifier") ||
    message.includes("both auth code and code verifier") ||
    message.includes("pkce")
  ) {
    return "pkce_required";
  }

  if (
    message.includes("expired") ||
    message.includes("otp_expired") ||
    message.includes("flow_state_expired")
  ) {
    return "expired_link";
  }

  if (
    message.includes("invalid") ||
    message.includes("already been used") ||
    message.includes("access_denied")
  ) {
    return "invalid_link";
  }

  if (message.includes("missing") && message.includes("code")) {
    return "missing_code";
  }

  return "auth_callback_failed";
}

export function sanitizeCallbackReason(reason: string | null): string | null {
  if (!reason?.trim()) {
    return null;
  }

  const decoded = decodeURIComponent(reason.trim());
  const cleaned = decoded.replace(/[<>"']/g, "").slice(0, 200);

  return cleaned || null;
}

export function getLoginCallbackErrorMessage(
  errorCode: string | null,
  reason: string | null,
): string | null {
  const safeReason = sanitizeCallbackReason(reason);
  if (safeReason) {
    return safeReason;
  }

  switch (errorCode) {
    case "pkce_required":
      return "Email confirmation must be opened in the same browser where you signed up. Sign in after confirming, or register again and open the link in that browser.";
    case "missing_code":
      return "The confirmation link is incomplete or expired. Request a new verification email and try again.";
    case "expired_link":
      return "This confirmation link has expired. Request a new verification email and try again.";
    case "invalid_link":
      return "This confirmation link is invalid or has already been used. Sign in or request a new verification email.";
    case "auth_callback_failed":
      return "Email confirmation could not be completed. Sign in if your email is already verified, or register again.";
    default:
      return null;
  }
}

export function buildLoginErrorRedirectUrl(
  origin: string,
  errorCode: CallbackErrorCode,
  reason?: string | null,
): string {
  const url = new URL("/login", origin);
  url.searchParams.set("error", errorCode);

  const safeReason = sanitizeCallbackReason(reason ?? null);
  if (safeReason) {
    url.searchParams.set("reason", encodeURIComponent(safeReason));
  }

  return url.toString();
}

export function buildResetPasswordErrorRedirectUrl(
  origin: string,
  errorCode: CallbackErrorCode,
  reason?: string | null,
): string {
  const url = new URL(RESET_PASSWORD_PATH, origin);
  url.searchParams.set("error", errorCode);

  const safeReason = sanitizeCallbackReason(reason ?? null);
  if (safeReason) {
    url.searchParams.set("reason", encodeURIComponent(safeReason));
  }

  return url.toString();
}
