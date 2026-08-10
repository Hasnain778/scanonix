import type { AuthError } from "@supabase/supabase-js";

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type SignInErrorKind = "invalid_credentials" | "email_not_verified" | "other";

export function classifySignInError(error: AuthError): SignInErrorKind {
  const message = error.message.toLowerCase();
  const code = (error.code ?? "").toLowerCase();

  if (
    code === "email_not_confirmed" ||
    message.includes("email not confirmed") ||
    message.includes("email not verified")
  ) {
    return "email_not_verified";
  }

  if (
    code === "invalid_credentials" ||
    message.includes("invalid login credentials") ||
    message.includes("invalid email or password")
  ) {
    return "invalid_credentials";
  }

  return "other";
}

export function mapSignInErrorMessage(error: AuthError): string {
  const kind = classifySignInError(error);

  if (kind === "email_not_verified") {
    return "Email not verified. Check your inbox for a confirmation link.";
  }

  if (kind === "invalid_credentials") {
    return "Invalid email or password.";
  }

  return "Sign in failed. Please try again.";
}

export const GOOGLE_ONLY_LOGIN_MESSAGE =
  "This account uses Google sign-in. Continue with Google or create a password using password reset.";
