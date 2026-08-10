"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthMessage } from "@/components/auth/AuthShell";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { ActionButton } from "@/components/ui/ActionButton";
import { createClient } from "@/lib/supabase/client";
import { buildAuthCallbackUrlClient } from "@/lib/auth/callback-url";
import {
  validateEmail,
  validateFullName,
  validatePassword,
  validatePasswordConfirmation,
} from "@/lib/validators/auth";

const VERIFICATION_SUCCESS_MESSAGE =
  "Account created. Check your email to verify your address before signing in.";

export function RegisterForm() {
  const router = useRouter();
  const { clearAuth } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timeout = window.setTimeout(() => {
      router.push("/login");
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [success, router]);

  function clearRegistrationForm() {
    setFullName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);

    const nextErrors: Record<string, string> = {};
    const nameError = validateFullName(fullName);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const confirmError = validatePasswordConfirmation(password, confirmPassword);

    if (nameError) nextErrors.fullName = nameError;
    if (emailError) nextErrors.email = emailError;
    if (passwordError) nextErrors.password = passwordError;
    if (confirmError) nextErrors.confirmPassword = confirmError;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: buildAuthCallbackUrlClient("/dashboard"),
        },
      });

      if (error) {
        setFormError(error.message);
        setLoading(false);
        return;
      }

      if (data.user?.identities?.length === 0) {
        setFormError(
          "An account with this email already exists. Sign in or reset your password instead.",
        );
        setLoading(false);
        return;
      }

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      // Email verification required — do not keep partial auth or stale navbar state.
      clearAuth();
      await supabase.auth.signOut({ scope: "local" });
      clearRegistrationForm();
      setSuccess(VERIFICATION_SUCCESS_MESSAGE);
      setLoading(false);
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes("Supabase is not configured")
          ? "Registration is unavailable. Check Supabase configuration."
          : error instanceof Error
            ? error.message
            : "Registration failed. Please try again.";
      setFormError(message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {formError && <AuthMessage type="error" message={formError} />}
      {success && <AuthMessage type="success" message={success} />}

      {!success && (
        <>
          <AuthInput
            label="Full name"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.fullName}
            disabled={loading}
          />

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
            autoComplete="new-password"
            showPasswordToggle
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            disabled={loading}
          />

          <AuthInput
            label="Confirm password"
            autoComplete="new-password"
            showPasswordToggle
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
            disabled={loading}
          />

          <ActionButton
            type="submit"
            size="lg"
            className="w-full"
            loading={loading}
            disabled={loading}
          >
            Create account
          </ActionButton>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="bg-scanonix-surface px-3 text-scanonix-muted">or</span>
            </div>
          </div>

          <GoogleSignInButton label="Sign up with Google" />
        </>
      )}

      {success && (
        <ActionButton
          type="button"
          size="lg"
          className="w-full"
          onClick={() => router.push("/login")}
        >
          Go to login
        </ActionButton>
      )}
    </form>
  );
}
