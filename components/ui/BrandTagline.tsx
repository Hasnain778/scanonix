interface BrandTaglineProps {
  className?: string;
}

export function BrandTagline({ className = "" }: BrandTaglineProps) {
  return (
    <span
      className={`block text-[9px] font-semibold uppercase leading-none tracking-[0.1em] text-neutral-400 sm:text-[10px] lg:text-[11px] lg:tracking-[0.12em] ${className}`}
    >
      Online Document Tools
    </span>
  );
}
