import type { LucideIcon } from "lucide-react";

interface ImageToolIconBoxProps {
  icon: LucideIcon;
  className?: string;
}

export function ImageToolIconBox({ icon: Icon, className = "" }: ImageToolIconBoxProps) {
  return (
    <span
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-scanonix-orange ${className}`}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
}
