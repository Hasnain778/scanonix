import { BrandTagline } from "@/components/ui/BrandTagline";
import { BrandWordmark } from "@/components/ui/BrandWordmark";
import { ScanonixLogo } from "@/components/ui/ScanonixLogo";

export type BrandLockupVariant = "desktop" | "compact" | "footer";

interface BrandLockupProps {
  variant?: BrandLockupVariant;
  priority?: boolean;
  /** Hide from assistive tech when a parent link supplies aria-label. */
  decorative?: boolean;
  className?: string;
}

export function BrandLockup({
  variant = "compact",
  priority = false,
  decorative = true,
  className = "",
}: BrandLockupProps) {
  const isDesktop = variant === "desktop";
  const isFooter = variant === "footer";
  const isCompact = variant === "compact";
  const logoSize = isDesktop ? 44 : 36;
  const wordmarkSize = isDesktop ? "header" : "footer";

  const logo = (
    <ScanonixLogo size={logoSize} priority={priority} className="shrink-0 rounded-md" />
  );

  return (
    <span
      className={`flex min-w-0 items-center ${
        isDesktop ? "gap-2.5 sm:gap-3" : isFooter ? "gap-2.5" : "gap-2"
      } ${className}`}
      aria-hidden={decorative ? true : undefined}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-[10px] border border-scanonix-orange/25 bg-scanonix-orange/[0.06] p-1 ${
          isDesktop
            ? "shadow-[0_0_16px_rgba(255,106,0,0.1)] transition-all duration-200 ease-out group-hover:border-scanonix-orange/45 group-hover:shadow-[0_0_20px_rgba(255,106,0,0.18)]"
            : isCompact
              ? "shadow-[0_0_12px_rgba(255,106,0,0.08)]"
              : ""
        }`}
      >
        {logo}
      </span>

      {isDesktop ? (
        <span className="flex min-w-0 flex-col gap-0.5 pt-px">
          <BrandWordmark size={wordmarkSize} />
          <BrandTagline className="hidden sm:block" />
        </span>
      ) : (
        <BrandWordmark size={wordmarkSize} className="min-w-0 truncate" />
      )}
    </span>
  );
}
