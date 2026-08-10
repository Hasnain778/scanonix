import {
  CheckCircle2,
  Layers,
  MonitorSmartphone,
  Shield,
  Zap,
} from "lucide-react";
import { HomeScrollFade } from "@/components/ui/HomeScrollFade";

const BENEFITS = {
  primary: {
    icon: Layers,
    title: "One platform",
    description: "Stop switching between separate websites.",
  },
  stacked: [
    {
      icon: Zap,
      title: "Fast processing",
      description: "Complete everyday tasks without unnecessary steps.",
    },
    {
      icon: Shield,
      title: "Privacy first",
      description: "Handle files and scans with secure workflows.",
    },
  ],
  strip: {
    icon: MonitorSmartphone,
    title: "Web and Android",
    description: "Use Scanonix wherever you work.",
  },
  metric: {
    icon: CheckCircle2,
    title: "Built for real tasks",
    description: "Clear tools without technical complexity.",
    stat: "20+",
    statLabel: "tools in one workspace",
  },
} as const;

export function HomeBenefits() {
  const PrimaryIcon = BENEFITS.primary.icon;
  const StripIcon = BENEFITS.strip.icon;
  const MetricIcon = BENEFITS.metric.icon;

  return (
    <section id="benefits" className="relative overflow-x-clip py-20 sm:py-28">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent"
        aria-hidden="true"
      />

      <div className="page-container">
        <HomeScrollFade>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Why Scanonix works better
            </h2>
          </div>
        </HomeScrollFade>

        <HomeScrollFade delay={80} className="mt-12 sm:mt-16">
          <div className="grid gap-4 lg:grid-cols-12 lg:grid-rows-[auto_auto]">
            <article className="home-benefit-primary relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-scanonix-orange/[0.08] via-white/[0.03] to-transparent p-8 lg:col-span-7 lg:row-span-2 lg:p-10">
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-scanonix-orange/10 blur-3xl"
                aria-hidden="true"
              />
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-scanonix-orange/30 bg-scanonix-orange/10">
                <PrimaryIcon className="h-5 w-5 text-scanonix-orange" strokeWidth={1.5} />
              </span>
              <h3 className="mt-6 text-2xl font-semibold text-white sm:text-3xl">
                {BENEFITS.primary.title}
              </h3>
              <p className="mt-3 max-w-md text-base leading-relaxed text-scanonix-muted sm:text-lg">
                {BENEFITS.primary.description}
              </p>
            </article>

            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
              {BENEFITS.stacked.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <article
                    key={benefit.title}
                    className="home-benefit-card rounded-2xl border border-white/8 bg-white/[0.03] p-6"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/20">
                      <Icon className="h-4 w-4 text-scanonix-orange" strokeWidth={1.5} />
                    </span>
                    <h3 className="mt-4 text-lg font-semibold text-white">{benefit.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-scanonix-muted">
                      {benefit.description}
                    </p>
                  </article>
                );
              })}
            </div>

            <article className="home-benefit-strip flex flex-col justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-6 sm:flex-row sm:items-center lg:col-span-8">
              <div className="flex items-start gap-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20">
                  <StripIcon className="h-4 w-4 text-scanonix-orange" strokeWidth={1.5} />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-white">{BENEFITS.strip.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-scanonix-muted">
                    {BENEFITS.strip.description}
                  </p>
                </div>
              </div>
            </article>

            <article className="home-benefit-metric flex flex-col justify-between rounded-2xl border border-scanonix-orange/20 bg-scanonix-orange/[0.05] p-6 lg:col-span-4">
              <div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-scanonix-orange/25 bg-scanonix-orange/10">
                  <MetricIcon className="h-4 w-4 text-scanonix-orange" strokeWidth={1.5} />
                </span>
                <p className="mt-4 font-mono text-3xl font-semibold tracking-tight text-white">
                  {BENEFITS.metric.stat}
                </p>
                <p className="text-xs uppercase tracking-[0.14em] text-scanonix-muted">
                  {BENEFITS.metric.statLabel}
                </p>
              </div>
              <div className="mt-4 border-t border-white/8 pt-4">
                <h3 className="text-base font-semibold text-white">{BENEFITS.metric.title}</h3>
                <p className="mt-1 text-sm text-scanonix-muted">{BENEFITS.metric.description}</p>
              </div>
            </article>
          </div>
        </HomeScrollFade>
      </div>
    </section>
  );
}
