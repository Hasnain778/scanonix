"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthMessage } from "@/components/auth/AuthShell";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { ActionButton } from "@/components/ui/ActionButton";
import { formatAuthError, logAuthDebug } from "@/lib/auth/auth-debug";
import { getLoginCallbackErrorMessage } from "@/lib/auth/callback-errors";
import {
  classifySignInError,
  GOOGLE_ONLY_LOGIN_MESSAGE,
  mapSignInErrorMessage,
  normalizeAuthEmail,
} from "@/lib/auth/login-errors";
import { getLoginHintForEmail } from "@/lib/auth/login-hints";
import { clientSignOut } from "@/lib/auth/client-sign-out";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { createClient, resetBrowserClient } from "@/lib/supabase/client";
import { validateEmail, validatePassword } from "@/lib/validators/auth";

function getLoginFormError(
  errorCode: string | null,
  reason: string | null,
  passwordResetSuccess: boolean,
): string | null {
  if (passwordResetSuccess) {
    return null;
  }

  return getLoginCallbackErrorMessage(errorCode, reason);
}

function formatLoginErrorForUser(message: string, supabaseMessage?: string, supabaseCode?: string): string {
  if (process.env.NODE_ENV === "development" && supabaseMessage) {
    return `${message} [${supabaseMessage}${supabaseCode ? ` / ${supabaseCode}` : ""}]`;
  }

  return message;
}

export function LoginForm() {
  const router = useRouter();
  const { refresh, clearAuth } = useAuth();
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirectPath(searchParams.get("redirect"));
  const passwordResetSuccess = searchParams.get("passwordReset") === "success";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(
    getLoginFormError(
      searchParams.get("error"),
      searchParams.get("reason"),
      passwordResetSuccess,
    ),
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }

    setFormError(null);

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const nextErrors = {
      email: emailError ?? undefined,
      password: passwordError ?? undefined,
    };
    setErrors(nextErrors);

    if (emailError || passwordError) {
      return;
    }

    setLoading(true);
    const normalizedEmail = normalizeAuthEmail(email);

    logAuthDebug("login.submit", {
      email: normalizedEmail,
      passwordLength: password.length,
    });

    try {
      clearAuth();
      await clientSignOut();
      resetBrowserClient();

      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      logAuthDebug("login.signInWithPassword", {
        email: normalizedEmail,
        passwordLength: password.length,
        userId: data.user?.id ?? null,
        ...formatAuthError(error),
      });

      if (error) {
        const kind = classifySignInError(error);

        if (kind === "invalid_credentials") {
          const hint = await getLoginHintForEmail(normalizedEmail);
          const message =
            hint === "google_only"
              ? GOOGLE_ONLY_LOGIN_MESSAGE
              : "Invalid email or password.";

          setFormError(formatLoginErrorForUser(message, error.message, error.code));
        } else {
          setFormError(
            formatLoginErrorForUser(mapSignInErrorMessage(error), error.message, error.code),
          );
        }

        setLoading(false);
        return;
      }

      await refresh();
      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      logAuthDebug("login.exception", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
      setFormError(
        error instanceof Error
          ? error.message
          : "Sign in is unavailable. Check Supabase configuration.",
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {passwordResetSuccess && (
        <AuthMessage
          type="success"
          message="Password updated successfully. Sign in with your new password."
        />
      )}
      {formError && <AuthMessage type="error" message={formError} />}

      <AuthInput
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        disabled={loading}
      />

      <AuthInput
        label="Password"
        autoComplete="current-password"
        showPasswordToggle
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        disabled={loading}
      />

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-scanonix-orange transition-colors hover:text-scanonix-orange-light"
        >
          Forgot password?
        </Link>
      </div>

      <ActionButton
        type="submit"
        size="lg"
        className="w-full"
        loading={loading}
        disabled={loading}
      >
        Sign in
      </ActionButton>

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wider">
          <span className="bg-scanonix-surface px-3 text-scanonix-muted">or</span>
        </div>
      </div>

      <GoogleSignInButton redirectTo={redirectTo} />
    </form>
  );
}
