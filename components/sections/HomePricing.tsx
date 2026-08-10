import { PricingPagePlans } from "@/components/pricing/PricingPagePlans";
import { HomeScrollFade } from "@/components/ui/HomeScrollFade";
import { getAuthUser } from "@/lib/auth/session";
import { resolveActivePricingPlanKey } from "@/lib/billing/pricing-state";

export async function HomePricing() {
  const user = await getAuthUser();
  const activePlanKey = resolveActivePricingPlanKey(user?.profile ?? null);

  return (
    <section id="pricing" className="relative overflow-x-clip py-20 sm:py-28">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 h-[420px] -translate-y-1/2 bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,rgba(255,106,0,0.06)_0%,transparent_70%)]"
        aria-hidden="true"
      />

      <div className="page-container relative">
        <HomeScrollFade>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Pricing
            </h2>
            <p className="mt-4 text-base leading-relaxed text-scanonix-muted sm:text-lg">
              Choose the plan that fits how you work.
            </p>
          </div>
        </HomeScrollFade>

        <HomeScrollFade delay={80} className="mt-12 sm:mt-14">
          <PricingPagePlans activePlanKey={activePlanKey} />
        </HomeScrollFade>
      </div>
    </section>
  );
}
