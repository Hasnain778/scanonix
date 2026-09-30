"use client";

import Link from "next/link";
import { Crown, Gauge, ImageUp, PenLine, Shield, type LucideIcon } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { useProAccess } from "@/hooks/useProAccess";
import { ANALYTICS_SURFACES } from "@/lib/analytics/surfaces";
import { trackEvent } from "@/lib/analytics/ga4";

/** Verified Pro benefits — sourced from TOOL_ACCESS, PLAN_LIMITS, and pricing copy. */
const PRO_BENEFITS = [
  "Advanced PDF security — Protect, Unlock, and Redact PDF",
  "4K image upscaling",
  "Premium AI tools — rewrite, translate, summary, and upscaling",
  "Expanded usage — 500 ops/month and 50MB uploads",
] as const;

const CAPABILITIES: readonly {
  title: string;
  detail: string;
  entitlement: (typeof PRO_BENEFITS)[number];
  icon: LucideIcon;
}[] = [
  {
    title: "Secure PDFs",
    detail: "Protect · Unlock · Redact",
    entitlement: PRO_BENEFITS[0],
    icon: Shield,
  },
  {
    title: "4K upscaling",
    detail: "Higher-resolution image processing",
    entitlement: PRO_BENEFITS[1],
    icon: ImageUp,
  },
  {
    title: "Premium AI",
    detail: "Rewrite · Translate · Summary",
    entitlement: PRO_BENEFITS[2],
    icon: PenLine,
  },
  {
    title: "Expanded limits",
    detail: "500 operations · 50 MB uploads",
    entitlement: PRO_BENEFITS[3],
    icon: Gauge,
  },
];

const TOOLKIT_ITEMS: readonly { label: string; value: string; icon: LucideIcon }[] = [
  { label: "Security", value: "Protect · Unlock · Redact", icon: Shield },
  { label: "AI", value: "Rewrite · Translate · Summary", icon: PenLine },
  { label: "Image", value: "4K upscaling", icon: ImageUp },
];

function CapabilityIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="scanonix-pro-promo__capability-icon" aria-hidden="true">
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </span>
  );
}

function ProCapability({
  title,
  detail,
  entitlement,
  icon,
}: (typeof CAPABILITIES)[number]) {
  return (
    <li className="scanonix-pro-promo__benefit" aria-label={entitlement}>
      <CapabilityIcon icon={icon} />
      <span className="scanonix-pro-promo__capability-copy">
        <span className="scanonix-pro-promo__capability-title">{title}</span>
        <span className="scanonix-pro-promo__capability-detail">{detail}</span>
      </span>
    </li>
  );
}

function ProHeadline({ member }: { member: boolean }) {
  if (member) {
    return (
      <h2
        id="scanonix-pro-promo-heading"
        className="scanonix-pro-promo__headline"
        aria-label="You're on Scanonix Pro"
      >
        <span className="scanonix-pro-promo__headline-line">You&apos;re on</span>
        <span className="scanonix-pro-promo__headline-line">
          Scanonix <span className="scanonix-pro-promo__accent">Pro</span>
        </span>
      </h2>
    );
  }

  return (
    <h2
      id="scanonix-pro-promo-heading"
      className="scanonix-pro-promo__headline"
      aria-label="Unlock more with Scanonix Pro"
    >
      <span className="scanonix-pro-promo__headline-line">Unlock more with</span>
      <span className="scanonix-pro-promo__headline-line">
        Scanonix <span className="scanonix-pro-promo__accent">Pro</span>
      </span>
    </h2>
  );
}

function ProToolkit() {
  return (
    <aside className="scanonix-pro-promo__toolkit" aria-label="Your Pro toolkit">
      <p className="scanonix-pro-promo__toolkit-kicker">Included with Pro</p>
      <h3 className="scanonix-pro-promo__toolkit-title">Your Pro toolkit</h3>
      <ul className="scanonix-pro-promo__toolkit-list">
        {TOOLKIT_ITEMS.map((item) => (
          <li key={item.label} className="scanonix-pro-promo__toolkit-item">
            <CapabilityIcon icon={item.icon} />
            <span className="scanonix-pro-promo__capability-copy">
              <span className="scanonix-pro-promo__toolkit-label">{item.label}</span>
              <span className="scanonix-pro-promo__toolkit-value">{item.value}</span>
            </span>
          </li>
        ))}
      </ul>
      <div
        className="scanonix-pro-promo__limits"
        aria-label="500 operations / month · 50 MB uploads"
      >
        <div>
          <p className="scanonix-pro-promo__limit-kicker">Monthly capacity</p>
          <p className="scanonix-pro-promo__limit-value">500 operations</p>
        </div>
        <div>
          <p className="scanonix-pro-promo__limit-kicker">Upload limit</p>
          <p className="scanonix-pro-promo__limit-value">50 MB</p>
        </div>
      </div>
    </aside>
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
          <svg
            className="scanonix-pro-promo__mark"
            viewBox="0 0 280 460"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M210 36c-96 8-168 78-142 162 28 90 150 96 122 184-22 70-112 98-186 72"
              fill="none"
              stroke="currentColor"
              strokeWidth="54"
              strokeLinecap="round"
            />
          </svg>
          <div className="scanonix-pro-promo__grid">
            <div className="scanonix-pro-promo__copy">
              <div className="scanonix-pro-promo__badge" aria-label="Scanonix Pro">
                <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Scanonix Pro</span>
              </div>

              <ProHeadline member={isPro && !loading} />

              <p className="scanonix-pro-promo__support">
                {isPro && !loading
                  ? "Your subscription unlocks advanced security tools, premium AI, and expanded processing limits across Scanonix."
                  : "Go beyond free tools with advanced PDF security, 4K upscaling, and premium AI processing."}
              </p>

              <div className="scanonix-pro-promo__cta">
                {loading ? (
                  <div
                    className="scanonix-pro-promo__cta-skeleton"
                    aria-hidden="true"
                    data-pro-promo-loading="true"
                  />
                ) : isPro ? (
                  <>
                    <ActionButton href="/dashboard" variant="primary" size="lg">
                      Go to dashboard
                      <span aria-hidden="true"> →</span>
                    </ActionButton>
                    <Link href="/account/billing" className="scanonix-pro-promo__secondary-link">
                      Manage plan
                    </Link>
                  </>
                ) : (
                  <ActionButton
                    href="/pricing"
                    variant="primary"
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

            <ul className="scanonix-pro-promo__benefits">
              {CAPABILITIES.map((capability) => (
                <ProCapability key={capability.entitlement} {...capability} />
              ))}
            </ul>

            <ProToolkit />
          </div>
        </div>
      </div>
    </section>
  );
}
