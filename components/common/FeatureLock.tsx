import Link from "next/link";
import { getFeature, type FeatureTier } from "@/config/features";
import { ANALYTICS_SURFACES } from "@/lib/analytics/surfaces";
import { trackEvent } from "@/lib/analytics/ga4";
import { PremiumBadge } from "./PremiumBadge";

interface FeatureLockProps {
  featureId: string;
  title?: string;
  description?: string;
  className?: string;
}

const tierLabels: Record<FeatureTier, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

export function FeatureLock({
  featureId,
  title,
  description,
  className = "",
}: FeatureLockProps) {
  const feature = getFeature(featureId);
  const tier = feature?.tier ?? "pro";
  const enabled = feature?.enabled ?? false;

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-scanonix-surface/80 p-6 text-center ${className}`}
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-scanonix-orange/10 text-scanonix-orange">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <div className="mb-2 flex items-center justify-center gap-2">
        <h3 className="text-lg font-semibold text-white">
          {title ?? feature?.name ?? "Premium feature"}
        </h3>
        <PremiumBadge />
      </div>
      <p className="mx-auto max-w-md text-sm text-scanonix-muted">
        {description ??
          (enabled
            ? `This feature requires a ${tierLabels[tier]} plan.`
            : "This feature is coming soon.")}
      </p>
      {enabled && (
        <Link
          href="/pricing"
          onClick={() => {
            trackEvent("upgrade_click", {
              source_surface: ANALYTICS_SURFACES.FEATURE_LOCK,
              tier,
            });
          }}
          className="mt-5 inline-flex items-center justify-center rounded-xl bg-scanonix-orange px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-scanonix-orange-light"
        >
          View {tierLabels[tier]} plans
        </Link>
      )}
    </div>
  );
}
