import Link from "next/link";
import { ArrowRight, FileImage } from "lucide-react";
import type { ImageConverterDefinition } from "@/constants/image-tools";
import { FormatDirection } from "@/components/image-tools/FormatDirection";
import { ImageToolIconBox } from "@/components/image-tools/ImageToolIconBox";

interface ConverterGridCardProps {
  converter: ImageConverterDefinition;
}

export function ConverterGridCard({ converter }: ConverterGridCardProps) {
  return (
    <Link
      href={`/tools/${converter.slug}`}
      className="image-converter-row group flex h-full flex-col rounded-xl border border-white/[0.06] bg-[#0a0a0a] p-4 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-white/12 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <ImageToolIconBox icon={FileImage} className="group-hover:border-scanonix-orange/30" />
        {converter.badge ? (
          <span className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-medium text-scanonix-muted">
            {converter.badge}
          </span>
        ) : null}
      </div>
      <div className="mt-4">
        <FormatDirection from={converter.from} to={converter.to} size="sm" />
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-scanonix-muted">
        {converter.shortDescription}
      </p>
      <p className="mt-2 text-xs text-scanonix-muted/70">
        Supports {converter.acceptExtensions.replaceAll(",", ", ")}
      </p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-scanonix-muted transition-colors group-hover:text-scanonix-orange">
        Open tool
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
