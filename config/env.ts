/**
 * Typed environment variable access.
 * Supabase keys are read from NEXT_PUBLIC_* (browser) with server/script fallbacks.
 *
 * Client components must import from `@/config/env.public` — dynamic process.env
 * reads here are not inlined into browser bundles by Next.js.
 */

import { resolveCanonicalSiteUrl } from "@/config/canonical-site-url";
import { resolveNativeProviderMode } from "@/lib/providers/runtime/production-guards";

function readEnv(key: string, fallback = ""): string {
  const value = process.env[key];
  return value?.trim() ?? fallback;
}

function readFirstEnv(keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = readEnv(key);
    if (value) return value;
  }
  return fallback;
}

export const env = {
  siteUrl: resolveCanonicalSiteUrl(readEnv("NEXT_PUBLIC_SITE_URL")),

  /** Supabase project URL — never hardcode */
  supabaseUrl: readFirstEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]),

  /** Supabase publishable (anon) key — safe for browser */
  supabasePublishableKey: readFirstEnv([
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
  ]),

  /** Stripe publishable key — safe for browser */
  stripePublishableKey: readEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),

  /** Server-only keys — never expose to client */
  stripeSecretKey: readEnv("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: readEnv("STRIPE_WEBHOOK_SECRET"),
  stripeProMonthlyPriceId: readEnv("STRIPE_PRO_MONTHLY_PRICE_ID"),
  stripeProYearlyPriceId: readEnv("STRIPE_PRO_YEARLY_PRICE_ID"),
  stripeBusinessMonthlyPriceId: readEnv("STRIPE_BUSINESS_MONTHLY_PRICE_ID"),
  stripeBusinessYearlyPriceId: readEnv("STRIPE_BUSINESS_YEARLY_PRICE_ID"),
  openAiApiKey: readEnv("OPENAI_API_KEY"),
  supabaseServiceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
  googleSafeBrowsingApiKey: readEnv("GOOGLE_SAFE_BROWSING_API_KEY"),
  urlHausApiKey: readEnv("URLHAUS_API_KEY"),
  phishTankApiKey: readEnv("PHISHTANK_API_KEY"),
  cronSecret: readEnv("CRON_SECRET"),
  /** Server-only Resend API key — never NEXT_PUBLIC_ */
  resendApiKey: readEnv("RESEND_API_KEY"),
  /** Server-only From address for transactional monitor alerts */
  emailFromAddress: readEnv("EMAIL_FROM_ADDRESS"),
  cloudConvertApiKey: readEnv("CLOUDCONVERT_API_KEY"),
  realesrganPython: readEnv("REALESRGAN_PYTHON"),
  realesrganOnnxPath: readEnv("REALESRGAN_ONNX_PATH"),
  realesrganServiceUrl: readEnv("REALESRGAN_SERVICE_URL"),
  realesrganServiceSecret: readFirstEnv([
    "REALESRGAN_SERVICE_SECRET",
    "REALESRGAN_WORKER_SECRET",
  ]),
  /** Server-only RunPod async upscale worker trigger */
  runpodApiKey: readEnv("RUNPOD_API_KEY"),
  runpodUpscaleEndpointId: readFirstEnv([
    "RUNPOD_UPSCALE_ENDPOINT_ID",
    "RUNPOD_ENDPOINT_ID",
  ]),
  rembgPython: readEnv("REMBG_PYTHON"),
  rembgServiceUrl: readEnv("REMBG_SERVICE_URL"),
  rembgServiceSecret: readFirstEnv(["REMBG_SERVICE_SECRET", "REMBG_WORKER_SECRET"]),
  rembgModel: readFirstEnv(["REMBG_MODEL"], "birefnet-general"),
  rembgModelDir: readEnv("REMBG_MODEL_DIR"),
  realesrganBin: readEnv("REALESRGAN_BIN"),
  realesrganModelDir: readEnv("REALESRGAN_MODEL_DIR"),
  realesrganModel: readFirstEnv(["REALESRGAN_MODEL"], "realesrgan-x4plus"),
  realesrganGpuId: readEnv("REALESRGAN_GPU_ID"),
  ghostscriptBin: readFirstEnv(["GHOSTSCRIPT_BIN", "GS_BIN"], "gs"),
  pdfCompressionServiceUrl: readEnv("PDF_COMPRESSION_SERVICE_URL"),
  pdfRedactionPython: readEnv("PDF_REDACTION_PYTHON"),
  pdfRedactionServiceUrl: readEnv("PDF_REDACTION_SERVICE_URL"),
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabasePublishableKey);
}

export function isStripeConfigured(): boolean {
  return Boolean(
    env.stripePublishableKey &&
      env.stripeSecretKey &&
      env.stripeProMonthlyPriceId &&
      env.stripeProYearlyPriceId &&
      env.stripeBusinessMonthlyPriceId &&
      env.stripeBusinessYearlyPriceId,
  );
}

export function isStripeWebhookConfigured(): boolean {
  return Boolean(env.stripeSecretKey && env.stripeWebhookSecret);
}

export function isStripePortalConfigured(): boolean {
  return isStripeConfigured();
}

export function isOpenAiConfigured(): boolean {
  return Boolean(env.openAiApiKey);
}

export function isCronSecretConfigured(): boolean {
  return Boolean(env.cronSecret);
}

export function isMonitorEmailConfigured(): boolean {
  return Boolean(env.resendApiKey && env.emailFromAddress);
}

export function isDomainReputationProviderConfigured(): boolean {
  return Boolean(
    env.googleSafeBrowsingApiKey ||
      env.urlHausApiKey ||
      env.phishTankApiKey,
  );
}

export function isCloudConvertConfigured(): boolean {
  return Boolean(env.cloudConvertApiKey);
}

export function isRealEsrganConfigured(): boolean {
  return (
    resolveNativeProviderMode(env.realesrganServiceUrl, env.realesrganBin) !==
    "unconfigured"
  );
}

export function isRunPodUpscaleWorkerConfigured(): boolean {
  return Boolean(env.runpodApiKey && env.runpodUpscaleEndpointId);
}

export function isRembgConfigured(): boolean {
  return (
    resolveNativeProviderMode(env.rembgServiceUrl, env.rembgPython) !== "unconfigured"
  );
}

export function isGhostscriptConfigured(): boolean {
  return (
    resolveNativeProviderMode(env.pdfCompressionServiceUrl, env.ghostscriptBin) !==
    "unconfigured"
  );
}

export function isPdfRedactionConfigured(): boolean {
  return (
    resolveNativeProviderMode(env.pdfRedactionServiceUrl, env.pdfRedactionPython) !==
    "unconfigured"
  );
}

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local",
    );
  }
}

export function assertStripeConfigured(): void {
  if (!isStripeConfigured()) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, and all STRIPE_*_PRICE_ID values in .env.local",
    );
  }
}
