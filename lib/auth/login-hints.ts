"use server";

import { env } from "@/config/env";
import { normalizeAuthEmail } from "@/lib/auth/login-errors";
import { createAdminClient } from "@/lib/supabase/admin";

export type LoginHint = "google_only" | "generic";

async function findAuthUserByEmail(email: string) {
  if (!env.supabaseServiceRoleKey) {
    return null;
  }

  try {
    const url = new URL(`${env.supabaseUrl}/auth/v1/admin/users`);
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "1");
    url.searchParams.set("filter", `email.eq.${email}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        apikey: env.supabasePublishableKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      users?: Array<{ identities?: Array<{ provider: string }> }>;
    };

    return payload.users?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns a login hint after a failed password sign-in.
 * Only distinguishes Google-only accounts; otherwise returns generic (no enumeration).
 */
export async function getLoginHintForEmail(email: string): Promise<LoginHint> {
  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail || !env.supabaseServiceRoleKey) {
    return "generic";
  }

  try {
    let user = await findAuthUserByEmail(normalizedEmail);

    if (!user) {
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      user =
        data.users.find(
          (entry) => entry.email?.trim().toLowerCase() === normalizedEmail,
        ) ?? null;
    }

    if (!user) {
      return "generic";
    }

    const providers = Array.from(
      new Set((user.identities ?? []).map((identity) => identity.provider)),
    );

    if (providers.length === 1 && providers[0] === "google") {
      return "google_only";
    }

    return "generic";
  } catch {
    return "generic";
  }
}
