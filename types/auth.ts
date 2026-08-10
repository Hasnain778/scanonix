export type UserPlan = "free" | "pro" | "business";
export type UserRole = "user" | "admin";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | string;

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  company_name?: string | null;
  job_title?: string | null;
  country?: string | null;
  time_zone?: string | null;
  plan: UserPlan;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: SubscriptionStatus | null;
  subscription_price_id?: string | null;
  subscription_current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  role?: UserRole;
  status?: "active" | "suspended";
  created_at: string;
  updated_at: string;
}

/** @deprecated Use Profile */
export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  tier: UserPlan;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile | null;
}

export type BillingPlan = Exclude<UserPlan, "free">;
export type BillingInterval = "monthly" | "yearly";

export interface CheckoutPlanRequest {
  plan: BillingPlan;
  interval: BillingInterval;
}

export interface NotificationPreferences {
  user_id: string;
  scan_completed: boolean;
  high_risk_found: boolean;
  weekly_summary: boolean;
  billing_alerts: boolean;
  product_updates: boolean;
  created_at: string;
  updated_at: string;
}

export type NotificationPreferenceKey = keyof Pick<
  NotificationPreferences,
  | "scan_completed"
  | "high_risk_found"
  | "weekly_summary"
  | "billing_alerts"
  | "product_updates"
>;

export interface AccountAuthDetails {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  providers: string[];
  hasPasswordLogin: boolean;
}
