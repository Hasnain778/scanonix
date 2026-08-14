import Link from "next/link";
import { ArrowRight, FileImage, WandSparkles } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { ImageToolIconBox } from "@/components/image-tools/ImageToolIconBox";

export function FeaturedBackgroundRemoverCard() {
  return (
    <article className="image-feature-hero relative h-full overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0a0a]">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col p-6 sm:p-8 lg:p-10">
          <div className="flex items-center gap-3">
            <ImageToolIconBox icon={WandSparkles} className="h-11 w-11" />
            <span className="rounded-md border border-scanonix-orange/25 bg-scanonix-orange/10 px-2.5 py-1 text-[11px] font-medium text-scanonix-orange">
              Premium
            </span>
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Background Remover
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-scanonix-muted sm:text-base">
            Remove backgrounds with secure server-side AI. Clean cut-outs for product photos,
            portraits, and documents.
          </p>
          <p className="mt-4 text-xs font-medium text-scanonix-muted">4K export available on Pro</p>
          <div className="mt-8">
            <ActionButton href="/tools/background-remover" size="lg">
              Open Background Remover
            </ActionButton>
          </div>
        </div>

        <div className="relative min-h-[220px] border-t border-white/10 lg:min-h-full lg:border-l lg:border-t-0">
          <div className="absolute inset-0 checkerboard-soft" aria-hidden="true" />
          <div className="relative flex h-full items-center justify-center p-6 sm:p-8">
            <div className="grid w-full max-w-sm grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-scanonix-muted">
                  Before
                </p>
                <div className="mt-3 aspect-square rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900" />
              </div>
              <div className="rounded-xl border border-scanonix-orange/20 bg-scanonix-orange/[0.04] p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-scanonix-orange">
                  After
                </p>
                <div className="checkerboard-soft mt-3 aspect-square rounded-lg border border-white/10">
                  <div className="flex h-full items-center justify-center text-xs text-scanonix-muted">
                    Transparent PNG
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

interface MediumConverterCardProps {
  slug: string;
  title: string;
  description: string;
  fromLabel: string;
  toLabel: string;
  badge?: string;
}

export function MediumConverterCard({
  slug,
  title,
  description,
  fromLabel,
  toLabel,
  badge,
}: MediumConverterCardProps) {
  return (
    <Link
      href={`/tools/${slug}`}
      className="image-medium-card group flex h-full flex-col rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-6 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-white/12 sm:p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <ImageToolIconBox icon={FileImage} />
        {badge ? (
          <span className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-medium text-scanonix-muted">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-5 inline-flex items-center gap-2 font-mono text-sm font-semibold text-white">
        <span className="rounded-md border border-white/10 px-2 py-1">{fromLabel}</span>
        <ArrowRight className="h-4 w-4 text-scanonix-muted" aria-hidden="true" />
        <span className="rounded-md border border-scanonix-orange/25 bg-scanonix-orange/10 px-2 py-1 text-scanonix-orange">
          {toLabel}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-scanonix-muted">{description}</p>
      <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-scanonix-muted group-hover:text-scanonix-orange">
        Open tool
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}
