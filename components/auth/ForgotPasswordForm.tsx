"use client";

import { useState, type FormEvent } from "react";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthMessage } from "@/components/auth/AuthShell";
import { ActionButton } from "@/components/ui/ActionButton";
import { normalizeAuthEmail } from "@/lib/auth/login-errors";
import { buildResetPasswordRedirectUrlClient } from "@/lib/auth/reset-password-url";
import { createClient } from "@/lib/supabase/client";
import { validateEmail } from "@/lib/validators/auth";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }

    setError(null);
    setSuccess(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setLoading(true);
    const normalizedEmail = normalizeAuthEmail(email);

    try {
      const supabase = createClient();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: buildResetPasswordRedirectUrlClient(),
        },
      );

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setSuccess(
        "If an account exists for that email, a password reset link has been sent.",
      );
      setLoading(false);
    } catch {
      setError("Password reset is unavailable. Check Supabase configuration.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && <AuthMessage type="error" message={error} />}
      {success && <AuthMessage type="success" message={success} />}

      <AuthInput
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading || Boolean(success)}
      />

      <ActionButton
        type="submit"
        size="lg"
        className="w-full"
        loading={loading}
        disabled={loading || Boolean(success)}
      >
        Send reset link
      </ActionButton>
    </form>
  );
}
