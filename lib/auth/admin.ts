import { NextResponse } from "next/server";
import { forbidden } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import type { AuthUser, Profile } from "@/types/auth";

export function isAdmin(profile: Profile | null | undefined): boolean {
  return profile?.role === "admin";
}

export function isAccountActive(profile: Profile | null | undefined): boolean {
  return profile?.status !== "suspended";
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    forbidden();
  }
  if (!isAdmin(user.profile)) {
    forbidden();
  }
  return user;
}

export async function requireAdminApi(): Promise<AuthUser | NextResponse> {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!isAdmin(user.profile)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  return user;
}

export async function requireActiveAccountApi(): Promise<AuthUser | NextResponse> {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!isAccountActive(user.profile)) {
    return NextResponse.json(
      { error: "Your account has been suspended. Contact support." },
      { status: 403 },
    );
  }
  return user;
}
