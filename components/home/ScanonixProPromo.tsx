"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Check, Crown, Shield, Sparkles } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { ToolVisual } from "@/components/tools/ToolVisual";
import { useProAccess } from "@/hooks/useProAccess";
import { ANALYTICS_SURFACES } from "@/lib/analytics/surfaces";
import { trackEvent } from "@/lib/analytics/ga4";

/** Verified Pro benefits — sourced from TOOL_ACCESS, PLAN_LIMITS, and pricing copy. */
const PRO_BENEFITS = [
  "Advanced PDF security — Protect, Unlock, and Redact PDF",
  "4K background removal export",
  "Premium AI tools — rewrite, translate, summary, and upscaling",
  "Expanded usage — 500 ops/month and 50MB uploads",
] as const;

const PRO_VISUAL_TOOLS = [
  { slug: "protect-pdf", label: "Protect PDF" },
  { slug: "redact-pdf", label: "Redact PDF" },
  { slug: "unlock-pdf", label: "Unlock PDF" },
  { slug: "background-remover", label: "Background Remover" },
] as const;

function ProBenefitCheck({ children }: { children: ReactNode }) {
  return (
    <li className="scanonix-pro-promo__benefit">
      <span className="scanonix-pro-promo__benefit-check" aria-hidden="true">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      <span>{children}</span>
    </li>
  );
}

function ProPromoVisual() {
  return (
    <div className="scanonix-pro-promo__visual" data-pro-promo-visual="tool-visuals">
      <div className="scanonix-pro-promo__visual-glow scanonix-pro-promo__visual-glow--orange" aria-hidden="true" />
      <div className="scanonix-pro-promo__visual-glow scanonix-pro-promo__visual-glow--violet" aria-hidden="true" />

      <div className="scanonix-pro-promo__doc-panel" aria-hidden="true">
        <span className="scanonix-pro-promo__doc-shield">
          <Shield className="h-5 w-5" />
        </span>
        <span className="scanonix-pro-promo__doc-spark">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="scanonix-pro-promo__doc-lines">
          <span />
          <span />
          <span className="scanonix-pro-promo__doc-lines--short" />
        </div>
      </div>

      <ul className="scanonix-pro-promo__float-cards" aria-hidden="true">
        {PRO_VISUAL_TOOLS.map((tool, index) => (
          <li
            key={tool.slug}
            className={`scanonix-pro-promo__float-card scanonix-pro-promo__float-card--${index + 1}`}
            data-tool-slug={tool.slug}
          >
            <ToolVisual slug={tool.slug} size="sm" />
            <span className="scanonix-pro-promo__float-card-label">{tool.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScanonixProPromo() {
  const { loading, isPro } = useProAccess();

  return (
    <section
      id="scanonix-pro-promo"
      className="scanonix-pro-promo"
      aria-labelledby="scanonix-pro-promo-heading"
      data-pro-promo-section="homepage"
    >
      <div className="page-container">
        <div className="scanonix-pro-promo__panel">
          <div className="scanonix-pro-promo__grid">
            <div className="scanonix-pro-promo__copy">
              <div className="scanonix-pro-promo__badge" aria-label="Scanonix Pro">
                <Crown className="h-3 w-3" aria-hidden="true" />
                <span>Scanonix Pro</span>
              </div>

              {isPro && !loading ? (
                <>
                  <h2 id="scanonix-pro-promo-heading" className="scanonix-pro-promo__headline">
                    You&apos;re on Scanonix Pro
                  </h2>
                  <p className="scanonix-pro-promo__support">
                    Your subscription unlocks advanced security tools, premium AI, and expanded
                    processing limits across Scanonix.
                  </p>
                </>
              ) : (
                <>
                  <h2 id="scanonix-pro-promo-heading" className="scanonix-pro-promo__headline">
                    Unlock more with Scanonix Pro
                  </h2>
                  <p className="scanonix-pro-promo__support">
                    Go beyond free tools with advanced PDF security, 4K exports, and premium AI
                    processing.
                  </p>
                </>
              )}

              <ul className="scanonix-pro-promo__benefits">
                {PRO_BENEFITS.map((benefit) => (
                  <ProBenefitCheck key={benefit}>{benefit}</ProBenefitCheck>
                ))}
              </ul>

              <div className="scanonix-pro-promo__cta">
                {loading ? (
                  <div
                    className="scanonix-pro-promo__cta-skeleton"
                    aria-hidden="true"
                    data-pro-promo-loading="true"
                  />
                ) : isPro ? (
                  <>
                    <ActionButton href="/dashboard" variant="outline" size="lg">
                      Go to dashboard
                    </ActionButton>
                    <Link href="/account/billing" className="scanonix-pro-promo__secondary-link">
                      Manage plan
                    </Link>
                  </>
                ) : (
                  <ActionButton
                    href="/pricing"
                    size="lg"
                    className="scanonix-pro-promo__cta-button"
                    data-pro-promo-cta="upgrade"
                    onClick={() => {
                      trackEvent("upgrade_click", {
                        source_surface: ANALYTICS_SURFACES.HOME_PRO_PROMO,
                        tier: "pro",
                      });
                    }}
                  >
                    Upgrade to Pro
                  </ActionButton>
                )}
              </div>
            </div>

            <ProPromoVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
