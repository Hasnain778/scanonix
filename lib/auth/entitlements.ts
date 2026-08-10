import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/stripe/server";
import type { Profile, UserPlan } from "@/types/auth";

export function hasActiveSubscription(
  profile: Profile | null | undefined,
): boolean {
  if (!profile?.subscription_status) {
    return false;
  }

  return ACTIVE_SUBSCRIPTION_STATUSES.has(profile.subscription_status);
}

export function getEffectivePlan(
  profile: Profile | null | undefined,
): UserPlan {
  if (!profile) {
    return "free";
  }

  if (!hasActiveSubscription(profile)) {
    return "free";
  }

  if (profile.plan === "pro" || profile.plan === "business") {
    return profile.plan;
  }

  return "free";
}

export function isPremiumPlan(plan: UserPlan | null | undefined): boolean {
  return plan === "pro" || plan === "business";
}

export function isPremiumProfile(profile: Profile | null | undefined): boolean {
  return isPremiumPlan(getEffectivePlan(profile));
}

export function canUse4KExport(profile: Profile | null | undefined): boolean {
  return isPremiumProfile(profile);
}

export function canUsePremiumAI(profile: Profile | null | undefined): boolean {
  return isPremiumProfile(profile);
}

export function canUseBatchProcessing(
  profile: Profile | null | undefined,
): boolean {
  return getEffectivePlan(profile) === "business";
}

export function canUseCloudStorage(
  profile: Profile | null | undefined,
): boolean {
  return isPremiumProfile(profile);
}

export function canUseBusinessFeatures(
  profile: Profile | null | undefined,
): boolean {
  return getEffectivePlan(profile) === "business";
}

export function requirePremiumProfile(
  profile: Profile | null | undefined,
  feature: string,
): { allowed: true } | { allowed: false; message: string } {
  if (isPremiumProfile(profile)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    message: `${feature} requires an active Pro or Business subscription.`,
  };
}

export function requireBusinessProfile(
  profile: Profile | null | undefined,
  feature: string,
): { allowed: true } | { allowed: false; message: string } {
  if (canUseBusinessFeatures(profile)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    message: `${feature} requires an active Business subscription.`,
  };
}
