"use client";

import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/auth";

/** Profile is only active when it belongs to the current Supabase user. */
export function getActiveProfile(
  user: User | null,
  profile: Profile | null,
): Profile | null {
  if (!user || !profile || profile.id !== user.id) {
    return null;
  }

  return profile;
}

export function getDisplayName(user: User, profile: Profile | null): string {
  const activeProfile = getActiveProfile(user, profile);
  const metadataName = user.user_metadata?.full_name;

  if (activeProfile?.full_name?.trim()) {
    return activeProfile.full_name.trim();
  }

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  return user.email?.split("@")[0] ?? "Account";
}

function readMetadataAvatarUrl(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null;

  for (const key of ["avatar_url", "picture", "avatar"] as const) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function getAvatarUrl(user: User, profile: Profile | null): string | null {
  const profileUrl = getActiveProfile(user, profile)?.avatar_url;
  if (profileUrl?.trim()) {
    return profileUrl.trim();
  }

  return readMetadataAvatarUrl(user.user_metadata as Record<string, unknown> | undefined);
}

export function getInitials(name: string | null | undefined, email: string): string {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }

  return email[0]?.toUpperCase() ?? "?";
}

export function isSupabaseAvatarUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith(".supabase.co") &&
      parsed.pathname.includes("/storage/v1/object/public/")
    );
  } catch {
    return false;
  }
}
