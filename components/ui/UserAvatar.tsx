"use client";

import Image from "next/image";
import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  getAvatarUrl,
  getDisplayName,
  getInitials,
  isSupabaseAvatarUrl,
} from "@/lib/auth/display";
import type { Profile } from "@/types/auth";

interface UserAvatarProps {
  user: User;
  profile?: Profile | null;
  size?: number;
  className?: string;
  textClassName?: string;
}

export function UserAvatar({
  user,
  profile = null,
  size = 32,
  className = "",
  textClassName = "text-sm",
}: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const avatarUrl = getAvatarUrl(user, profile);
  const displayName = getDisplayName(user, profile);
  const initials = getInitials(displayName, user.email ?? "");
  const showImage = Boolean(avatarUrl) && failedUrl !== avatarUrl;

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-scanonix-orange/15 font-bold text-scanonix-orange ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {showImage && avatarUrl ? (
        isSupabaseAvatarUrl(avatarUrl) ? (
          <Image
            src={avatarUrl}
            alt=""
            width={size}
            height={size}
            className="h-full w-full object-cover"
            unoptimized
            onError={() => avatarUrl && setFailedUrl(avatarUrl)}
          />
        ) : (
          // Remote OAuth avatars (Google, etc.) use a native img with error fallback.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            width={size}
            height={size}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            decoding="async"
            onError={() => avatarUrl && setFailedUrl(avatarUrl)}
          />
        )
      ) : (
        <span className={textClassName}>{initials}</span>
      )}
    </span>
  );
}
