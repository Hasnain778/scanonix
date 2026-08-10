import {
  isCronSecretConfigured,
  isStripeConfigured,
  isStripeWebhookConfigured,
  isSupabaseConfigured,
  env,
} from "@/config/env";

export interface ProductionEnvIssue {
  variable: string;
  message: string;
  severity: "error" | "warning";
}

/** Validate required production environment variables. */
export function validateProductionEnv(): ProductionEnvIssue[] {
  const issues: ProductionEnvIssue[] = [];

  if (!env.siteUrl || env.siteUrl.includes("localhost")) {
    issues.push({
      variable: "NEXT_PUBLIC_SITE_URL",
      message: "Must be set to your production domain (https://…).",
      severity: "error",
    });
  }

  if (!isSupabaseConfigured()) {
    issues.push({
      variable: "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      message: "Supabase credentials are required.",
      severity: "error",
    });
  }

  if (!env.supabaseServiceRoleKey) {
    issues.push({
      variable: "SUPABASE_SERVICE_ROLE_KEY",
      message: "Required for admin queries, webhooks, and scheduled monitoring.",
      severity: "error",
    });
  }

  if (!isCronSecretConfigured()) {
    issues.push({
      variable: "CRON_SECRET",
      message: "Required to protect /api/cron/monitors/run in production.",
      severity: "error",
    });
  }

  if (!isStripeConfigured()) {
    issues.push({
      variable: "STRIPE_*",
      message: "Stripe keys and price IDs are required for billing.",
      severity: "warning",
    });
  }

  if (!isStripeWebhookConfigured()) {
    issues.push({
      variable: "STRIPE_WEBHOOK_SECRET",
      message: "Required for subscription lifecycle webhooks.",
      severity: "warning",
    });
  }

  return issues;
}

export function assertProductionEnv(): void {
  const errors = validateProductionEnv().filter((i) => i.severity === "error");
  if (errors.length === 0) return;

  const summary = errors.map((e) => `${e.variable}: ${e.message}`).join("\n");
  throw new Error(`Production environment validation failed:\n${summary}`);
}
