import { Suspense } from "react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PricingPlans } from "@/components/billing/BillingPanels";
import { LoadingState } from "@/components/common/LoadingState";
import { PageBackground } from "@/components/ui/PageBackground";
import { getAuthUser } from "@/lib/auth/session";
import { resolveActivePricingPlanKey } from "@/lib/billing/pricing-state";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Pricing | Scanonix",
  description:
    "Compare Scanonix Free, Pro, and Business plans for online PDF, image, and AI document tools.",
  path: "/pricing",
});

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
  const user = await getAuthUser();
  const activePlanKey = resolveActivePricingPlanKey(user?.profile ?? null);

  return (
    <>
      <PageBackground />
      <Navbar />
      <main className="relative z-10 min-h-screen pt-28 pb-20 sm:pt-32 sm:pb-24">
        <div className="page-container mx-auto max-w-[1200px]">
          <header className="mb-14 text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Pricing</h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-foreground-muted sm:text-lg">
              Choose the plan that&apos;s right for you.
            </p>
          </header>

          {params.checkout === "cancelled" && (
            <p className="mb-8 rounded-2xl border border-border bg-surface-muted px-4 py-3 text-center text-sm text-foreground-muted">
              Checkout was cancelled. You can choose a plan whenever you are ready.
            </p>
          )}

          <Suspense fallback={<LoadingState title="Loading plans…" className="py-12" />}>
            <PricingPlans activePlanKey={activePlanKey} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}
