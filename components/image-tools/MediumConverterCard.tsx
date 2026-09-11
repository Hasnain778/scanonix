import Link from "next/link";
import { ArrowRight, FileImage } from "lucide-react";
import { ImageToolIconBox } from "@/components/image-tools/ImageToolIconBox";

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
      className="image-medium-card group flex h-full flex-col rounded-2xl border border-border bg-surface p-6 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-scanonix-orange/35 sm:p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <ImageToolIconBox icon={FileImage} />
        {badge ? (
          <span className="rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-foreground-muted">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-5 inline-flex items-center gap-2 font-mono text-sm font-semibold text-foreground">
        <span className="rounded-md border border-border px-2 py-1">{fromLabel}</span>
        <ArrowRight className="h-4 w-4 text-foreground-muted" aria-hidden="true" />
        <span className="rounded-md border border-scanonix-orange/25 bg-scanonix-orange/10 px-2 py-1 text-scanonix-orange">
          {toLabel}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground-muted">{description}</p>
      <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-foreground-muted group-hover:text-scanonix-orange">
        Open tool
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}
