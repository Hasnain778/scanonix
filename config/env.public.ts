/**
 * Browser-safe public environment variables.
 * Use literal process.env.NEXT_PUBLIC_* access so Next.js inlines them in client bundles.
 * Do not read server-only keys here.
 */

import { resolveCanonicalSiteUrl } from "@/config/canonical-site-url";

export const publicEnv = {
  siteUrl: resolveCanonicalSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "",
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
} as const;

export function isSupabaseConfiguredClient(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabasePublishableKey);
}

export function assertSupabaseConfiguredClient(): void {
  if (!isSupabaseConfiguredClient()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local",
    );
  }
}
