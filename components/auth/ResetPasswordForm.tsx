"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthMessage } from "@/components/auth/AuthShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { ActionButton } from "@/components/ui/ActionButton";
import { formatAuthError, logAuthDebug } from "@/lib/auth/auth-debug";
import { clientSignOut } from "@/lib/auth/client-sign-out";
import { normalizeAuthEmail } from "@/lib/auth/login-errors";
import {
  buildRecoveryCallbackUrl,
  RESET_PASSWORD_PATH,
} from "@/lib/auth/reset-password-url";
import { syncBrowserAuthSession } from "@/lib/auth/sync-browser-session";
import { createClient, resetBrowserClient } from "@/lib/supabase/client";
import {
  validatePassword,
  validatePasswordConfirmation,
} from "@/lib/validators/auth";

const INVALID_LINK_MESSAGE = "This reset link is invalid or has expired.";

function getResetFormError(errorCode: string | null): string | null {
  if (
    errorCode === "invalid_or_expired_link" ||
    errorCode === "expired_link" ||
    errorCode === "invalid_link" ||
    errorCode === "missing_code" ||
    errorCode === "pkce_required" ||
    errorCode === "auth_callback_failed"
  ) {
    return INVALID_LINK_MESSAGE;
  }

  return null;
}

function mapPasswordUpdateError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("expired") || lower.includes("otp_expired")) {
    return INVALID_LINK_MESSAGE;
  }

  if (
    lower.includes("session") ||
    lower.includes("not authenticated") ||
    lower.includes("jwt")
  ) {
    return INVALID_LINK_MESSAGE;
  }

  return message;
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearAuth } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(
    getResetFormError(searchParams.get("error")),
  );
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function initializeRecoverySession() {
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");

      if (code) {
        const callbackUrl = buildRecoveryCallbackUrl(window.location.origin, code);
        logAuthDebug("recovery.redirectToCallback", { callbackUrl });
        window.location.replace(callbackUrl);
        return;
      }

      if (tokenHash && type === "recovery") {
        const callbackUrl = new URL("/auth/callback", window.location.origin);
        callbackUrl.searchParams.set("token_hash", tokenHash);
        callbackUrl.searchParams.set("type", type);
        callbackUrl.searchParams.set("next", RESET_PASSWORD_PATH);
        logAuthDebug("recovery.redirectToCallback", { callbackUrl: callbackUrl.toString() });
        window.location.replace(callbackUrl.toString());
        return;
      }

      const { session, error } = await syncBrowserAuthSession();

      if (cancelled) {
        return;
      }

      logAuthDebug("recovery.sessionFromCookies", {
        hasSession: Boolean(session),
        userId: session?.user.id ?? null,
        email: session?.user.email ?? null,
        recoverySentAt: session?.user.recovery_sent_at ?? null,
        ...formatAuthError(error),
      });

      if (error || !session?.user) {
        setSessionReady(false);
        setFormError((current) => current ?? INVALID_LINK_MESSAGE);
        setCheckingSession(false);
        return;
      }

      setSessionReady(true);
      setFormError(null);
      setCheckingSession(false);
    }

    void initializeRecoverySession();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }

    setFormError(null);
    setSuccess(null);

    const { session, error: sessionError } = await syncBrowserAuthSession();
    if (sessionError || !session?.user?.email) {
      setFormError(INVALID_LINK_MESSAGE);
      setSessionReady(false);
      return;
    }

    const nextErrors: Record<string, string> = {};
    const passwordError = validatePassword(password);
    const confirmError = validatePasswordConfirmation(password, confirmPassword);

    if (passwordError) nextErrors.password = passwordError;
    if (confirmError) nextErrors.confirmPassword = confirmError;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      logAuthDebug("recovery.beforeUpdateUser", {
        userId: user?.id ?? null,
        email: user?.email ?? null,
        recoverySentAt: user?.recovery_sent_at ?? null,
        ...formatAuthError(userError),
      });

      if (userError || !user?.email) {
        setFormError(INVALID_LINK_MESSAGE);
        setSessionReady(false);
        setLoading(false);
        return;
      }

      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password,
      });

      logAuthDebug("recovery.updateUser", {
        userId: updateData.user?.id ?? null,
        email: updateData.user?.email ?? null,
        ...formatAuthError(updateError),
      });

      if (updateError) {
        setFormError(mapPasswordUpdateError(updateError.message));
        setLoading(false);
        return;
      }

      const normalizedEmail = normalizeAuthEmail(user.email);
      await clientSignOut();
      clearAuth();
      resetBrowserClient();

      const verifyClient = createClient();
      const { error: verifyError } = await verifyClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      logAuthDebug("recovery.verifySignInWithPassword", {
        email: normalizedEmail,
        passwordLength: password.length,
        ...formatAuthError(verifyError),
      });

      if (verifyError) {
        setFormError(
          `Password update could not be verified: ${verifyError.message}${verifyError.code ? ` (${verifyError.code})` : ""}`,
        );
        setSessionReady(false);
        setLoading(false);
        return;
      }

      await clientSignOut();
      clearAuth();
      resetBrowserClient();

      setSuccess("Password updated successfully. Redirecting to sign in…");
      setLoading(false);

      setTimeout(() => {
        router.push("/login?passwordReset=success");
        router.refresh();
      }, 1200);
    } catch (error) {
      logAuthDebug("recovery.handleSubmit.exception", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
      setFormError(
        error instanceof Error
          ? error.message
          : "Password reset is unavailable. Check Supabase configuration.",
      );
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <p className="text-sm text-scanonix-muted" role="status">
        Verifying your reset link…
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {formError && <AuthMessage type="error" message={formError} />}
      {success && <AuthMessage type="success" message={success} />}

      {!sessionReady && (
        <div className="space-y-3">
          <ActionButton
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => router.push("/forgot-password")}
          >
            Request another reset email
          </ActionButton>
        </div>
      )}

      <AuthInput
        label="New password"
        autoComplete="new-password"
        showPasswordToggle
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        disabled={loading || Boolean(success) || !sessionReady}
      />
      {sessionReady && (
        <p className="-mt-2 text-xs text-scanonix-muted">
          Use at least 8 characters with a mix of letters and numbers.
        </p>
      )}

      <AuthInput
        label="Confirm new password"
        autoComplete="new-password"
        showPasswordToggle
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={errors.confirmPassword}
        disabled={loading || Boolean(success) || !sessionReady}
      />

      <ActionButton
        type="submit"
        size="lg"
        className="w-full"
        loading={loading}
        disabled={loading || Boolean(success) || !sessionReady}
      >
        Update password
      </ActionButton>
    </form>
  );
}
