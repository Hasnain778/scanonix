"use client";

import Link from "next/link";
import { Shield, Lock } from "lucide-react";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { ProBadge } from "@/components/tools/background-remover/ProBadge";
import { ANALYTICS_SURFACES } from "@/lib/analytics/surfaces";
import { trackEvent } from "@/lib/analytics/ga4";

interface ProSecurityGateProps {
  title?: string;
  description?: string;
  isAuthenticated?: boolean;
  toolSlug?: string;
}

function trackSecurityGateUpgradeClick(toolSlug?: string): void {
  trackEvent("upgrade_click", {
    source_surface: ANALYTICS_SURFACES.SECURITY_GATE,
    tier: "pro",
    ...(toolSlug ? { tool_slug: toolSlug } : {}),
  });
}

export function ProSecurityGate({
  title = "Pro security feature",
  description = "Upgrade to Scanonix Pro to process files, run scans, and access advanced security tools.",
  isAuthenticated = true,
  toolSlug,
}: ProSecurityGateProps) {
  return (
    <div
      data-pro-security-gate
      className="pro-security-gate rounded-2xl border border-scanonix-orange/35 bg-gradient-to-br from-scanonix-orange/8 via-surface-raised to-surface p-6 shadow-[0_0_0_1px_color-mix(in_srgb,var(--scanonix-orange)_8%,transparent),0_8px_28px_color-mix(in_srgb,var(--scanonix-orange)_10%,transparent)] sm:p-8"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-scanonix-orange/35 bg-scanonix-orange/12 text-scanonix-orange">
          <Shield className="h-6 w-6" aria-hidden="true" />
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
              Server-side processing with encrypted delivery
            </li>
            <li className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-scanonix-orange" aria-hidden="true" />
              Higher upload limits and priority security scans
            </li>
            <li className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-scanonix-orange" aria-hidden="true" />
              Website monitoring and saved scan history
            </li>
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!isAuthenticated ? (
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl bg-scanonix-orange px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400"
              >
                Sign in to continue
              </Link>
            ) : (
              <>
                <CheckoutButton
                  plan="pro"
                  interval="monthly"
                  label="Upgrade to Pro"
                  sourceSurface={ANALYTICS_SURFACES.SECURITY_GATE}
                />
                <Link
                  href="/pricing"
                  onClick={() => trackSecurityGateUpgradeClick(toolSlug)}
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
