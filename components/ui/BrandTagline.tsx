interface BrandTaglineProps {
  className?: string;
  /** Sidebar uses a fixed two-line stack for balanced hierarchy in w-56 nav. */
  variant?: "default" | "sidebar";
}

export function BrandTagline({ className = "", variant = "default" }: BrandTaglineProps) {
  if (variant === "sidebar") {
    return (
      <span
        className={`flex flex-col gap-px text-[9.5px] font-semibold uppercase leading-none tracking-[0.06em] text-foreground-muted ${className}`}
      >
        <span>Online Document</span>
        <span>Tools</span>
      </span>
    );
  }

  return (
    <span
      className={`block text-[9px] font-semibold uppercase leading-none tracking-[0.1em] text-foreground-muted sm:text-[10px] lg:text-[11px] lg:tracking-[0.12em] ${className}`}
    >
      Online Document Tools
    </span>
  );
}
