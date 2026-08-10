import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/config/env";
import { formatAuthError, logAuthDebug } from "@/lib/auth/auth-debug";
import {
  buildLoginErrorRedirectUrl,
  getCallbackErrorCode,
  type CallbackErrorCode,
} from "@/lib/auth/callback-errors";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { RESET_PASSWORD_PATH } from "@/lib/auth/reset-password-url";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

const OTP_TYPES = new Set<string>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function parseOtpType(value: string | null): EmailOtpType | null {
  if (!value || !OTP_TYPES.has(value)) {
    return null;
  }

  return value as EmailOtpType;
}

function isRecoveryType(type: EmailOtpType | null): boolean {
  return type === "recovery";
}

function isRecoveryFlow(otpType: EmailOtpType | null, next: string): boolean {
  return (
    isRecoveryType(otpType) ||
    next === "/reset-password" ||
    next === RESET_PASSWORD_PATH
  );
}

function buildRecoveryErrorRedirect(origin: string): string {
  const url = new URL(RESET_PASSWORD_PATH, origin);
  url.searchParams.set("error", "invalid_or_expired_link");
  return url.toString();
}

function redirectAfterCallbackError(
  origin: string,
  errorCode: CallbackErrorCode,
  reason: string | null,
  otpType: EmailOtpType | null,
  next: string,
): NextResponse {
  if (isRecoveryFlow(otpType, next)) {
    logAuthDebug("callback.recoveryFailed", {
      errorCode,
      reason,
      next,
    });
    return NextResponse.redirect(buildRecoveryErrorRedirect(origin));
  }

  const url = buildLoginErrorRedirectUrl(origin, errorCode, reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const otpType = parseOtpType(searchParams.get("type"));
  const next = getSafeRedirectPath(searchParams.get("next"));
  const authError = searchParams.get("error");
  const authErrorDescription = searchParams.get("error_description");
  const recovery = isRecoveryFlow(otpType, next);

  if (authError) {
    const errorCode = getCallbackErrorCode({
      message: authErrorDescription ?? authError,
      code: authError,
    });
    return redirectAfterCallbackError(
      origin,
      errorCode,
      authErrorDescription ?? authError,
      otpType,
      next,
    );
  }

  const successUrl = recovery ? `${origin}${RESET_PASSWORD_PATH}` : `${origin}${next}`;
  const response = NextResponse.redirect(successUrl);
  const supabase = createRouteHandlerClient(request, response);

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    logAuthDebug("callback.exchangeCodeForSession", {
      recovery,
      next,
      hasSession: Boolean(data.session),
      userId: data.session?.user.id ?? null,
      email: data.session?.user.email ?? null,
      ...formatAuthError(error),
    });

    if (error) {
      const errorCode = getCallbackErrorCode(error);
      return redirectAfterCallbackError(origin, errorCode, error.message, otpType, next);
    }

    return response;
  }

  if (tokenHash && otpType) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });

    logAuthDebug("callback.verifyOtp", {
      recovery,
      otpType,
      hasSession: Boolean(data.session),
      userId: data.session?.user.id ?? null,
      email: data.session?.user.email ?? null,
      ...formatAuthError(error),
    });

    if (error) {
      const errorCode = getCallbackErrorCode(error);
      return redirectAfterCallbackError(origin, errorCode, error.message, otpType, next);
    }

    return response;
  }

  return redirectAfterCallbackError(
    origin,
    "missing_code",
    "Missing confirmation code or token.",
    otpType,
    next,
  );
}
