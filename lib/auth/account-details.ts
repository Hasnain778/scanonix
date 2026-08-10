import type { User } from "@supabase/supabase-js";
import type { AccountAuthDetails } from "@/types/auth";

function formatProvider(provider: string): string {
  if (provider === "email") return "Email & password";
  if (provider === "google") return "Google";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function getAccountAuthDetails(user: User): AccountAuthDetails {
  const identities = user.identities ?? [];
  const providers = Array.from(
    new Set(
      identities.length > 0
        ? identities.map((identity) => identity.provider)
        : [String(user.app_metadata?.provider ?? "email")],
    ),
  );

  return {
    id: user.id,
    email: user.email ?? "",
    emailVerified: Boolean(user.email_confirmed_at),
    createdAt: user.created_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    providers: providers.map(formatProvider),
    hasPasswordLogin: providers.includes("email"),
  };
}
