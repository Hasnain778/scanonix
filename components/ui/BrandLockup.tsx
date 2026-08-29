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

/**
 * Shared brand lockup — standalone transparent S (no black tile) + wordmark.
 * Desktop shows tagline; compact/footer omit tagline for space.
 */
export function BrandLockup({
  variant = "compact",
  priority = false,
  decorative = true,
  className = "",
}: BrandLockupProps) {
  const isDesktop = variant === "desktop";
  const isFooter = variant === "footer";
  // Visual targets: desktop ~48–54px, mobile ~38–44px; footer stays compact.
  const logoSize = isDesktop ? 50 : isFooter ? 32 : 40;
  const wordmarkSize = isDesktop ? "header" : "footer";

  return (
    <span
      className={`flex min-w-0 items-center ${
        isDesktop ? "gap-2.5 sm:gap-3" : isFooter ? "gap-2.5" : "gap-2"
      } ${className}`}
      aria-hidden={decorative ? true : undefined}
    >
      <span className={`brand-logo-mark shrink-0 ${isDesktop ? "brand-logo-mark--header" : ""}`}>
        <ScanonixLogo
          appearance="mark"
          size={logoSize}
          priority={priority}
          className="brand-logo-mark__img"
        />
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
