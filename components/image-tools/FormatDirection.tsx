import { ArrowRight } from "lucide-react";
import type { ImageFormatId } from "@/constants/image-tools";
import { FORMAT_LABELS } from "@/lib/image/formats";

interface FormatDirectionProps {
  from: ImageFormatId;
  to: ImageFormatId;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: { box: "h-7 min-w-[2.75rem] px-2 text-[10px]", arrow: "h-3.5 w-3.5" },
  md: { box: "h-8 min-w-[3rem] px-2.5 text-[11px]", arrow: "h-4 w-4" },
  lg: { box: "h-10 min-w-[3.5rem] px-3 text-xs", arrow: "h-4 w-4" },
};

export function FormatDirection({ from, to, size = "md" }: FormatDirectionProps) {
  const styles = SIZE_CLASSES[size];

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center justify-center rounded-md border border-border bg-surface-muted font-mono font-semibold tracking-wide text-foreground ${styles.box}`}
      >
        {FORMAT_LABELS[from]}
      </span>
      <ArrowRight className={`shrink-0 text-scanonix-muted ${styles.arrow}`} aria-hidden="true" />
      <span
        className={`inline-flex items-center justify-center rounded-md border border-scanonix-orange/25 bg-scanonix-orange/10 font-mono font-semibold tracking-wide text-scanonix-orange ${styles.box}`}
      >
        {FORMAT_LABELS[to]}
      </span>
    </div>
  );
}
