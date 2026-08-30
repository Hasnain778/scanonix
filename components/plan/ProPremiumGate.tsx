"use client";

import Link from "next/link";
import { Sparkles, Lock } from "lucide-react";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { ProBadge } from "@/components/tools/background-remover/ProBadge";
import { ANALYTICS_SURFACES } from "@/lib/analytics/surfaces";
import { trackEvent } from "@/lib/analytics/ga4";

interface ProPremiumGateProps {
  title?: string;
  description?: string;
  isAuthenticated?: boolean;
  toolSlug?: string;
}

function trackProGateUpgradeClick(toolSlug?: string): void {
  trackEvent("upgrade_click", {
    source_surface: ANALYTICS_SURFACES.PRO_GATE,
    tier: "pro",
    ...(toolSlug ? { tool_slug: toolSlug } : {}),
  });
}

export function ProPremiumGate({
  title = "Pro AI feature",
  description = "Upgrade to Scanonix Pro to use AI rewrite, translation, summary, and image upscaling.",
  isAuthenticated = false,
  toolSlug,
}: ProPremiumGateProps) {
  return (
    <div
      data-pro-premium-gate
      className="pro-security-gate rounded-2xl border border-scanonix-orange/35 bg-gradient-to-br from-scanonix-orange/8 via-surface-raised to-surface p-6 shadow-[0_0_0_1px_color-mix(in_srgb,var(--scanonix-orange)_8%,transparent),0_8px_28px_color-mix(in_srgb,var(--scanonix-orange)_10%,transparent)] sm:p-8"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-scanonix-orange/35 bg-scanonix-orange/12 text-scanonix-orange">
          <Sparkles className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <ProBadge />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{description}</p>

          <ul className="mt-4 space-y-2 text-sm text-foreground-muted">
            <li className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-scanonix-orange" aria-hidden="true" />
              Cloud AI processing with higher daily limits
            </li>
            <li className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-scanonix-orange" aria-hidden="true" />
              Image upscaling and advanced rewrite controls
            </li>
            <li className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-scanonix-orange" aria-hidden="true" />
              Free tools remain available without an account
            </li>
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!isAuthenticated ? (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl bg-scanonix-orange px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400"
                >
                  Sign in to continue
                </Link>
                <Link
                  href="/pricing"
                  onClick={() => trackProGateUpgradeClick(toolSlug)}
                  className="text-sm font-medium text-scanonix-orange transition hover:text-orange-300"
                >
                  View Pro plans
                </Link>
              </>
            ) : (
              <>
                <CheckoutButton
                  plan="pro"
                  interval="monthly"
                  label="Upgrade to Pro"
                  sourceSurface={ANALYTICS_SURFACES.PRO_GATE}
                />
                <Link
                  href="/pricing"
                  onClick={() => trackProGateUpgradeClick(toolSlug)}
                  className="text-sm font-medium text-scanonix-orange transition hover:text-orange-300"
                >
                  Compare plans
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
