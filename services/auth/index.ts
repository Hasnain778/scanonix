/**
 * Authentication service — backed by Supabase.
 */
export { getAuthUser, requireAuth } from "@/lib/auth/session";
export { signOutAction } from "@/lib/auth/actions";
export type { AuthUser, Profile, UserPlan } from "@/types/auth";
