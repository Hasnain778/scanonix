import Link from "next/link";
import { BrandTagline } from "@/components/ui/BrandTagline";
import { BrandWordmark } from "@/components/ui/BrandWordmark";
import { ScanonixLogo } from "@/components/ui/ScanonixLogo";

interface NavbarBrandProps {
  onNavigate?: () => void;
}

const LOGO_SIZE = 44;

export function NavbarBrand({ onNavigate }: NavbarBrandProps) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className="group flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl outline-none transition-transform duration-200 ease-out hover:scale-[1.015] focus-visible:ring-2 focus-visible:ring-scanonix-orange/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:gap-3"
      aria-label="SCANONIX home"
    >
      <span
        className="flex shrink-0 items-center justify-center rounded-[10px] border border-scanonix-orange/25 bg-scanonix-orange/[0.06] p-1 shadow-[0_0_16px_rgba(255,106,0,0.1)] transition-all duration-200 ease-out group-hover:border-scanonix-orange/45 group-hover:shadow-[0_0_20px_rgba(255,106,0,0.18)]"
        aria-hidden="true"
      >
        <ScanonixLogo
          size={LOGO_SIZE}
          priority
          className="rounded-md"
        />
      </span>

      <span className="flex min-w-0 flex-col gap-0.5 pt-px">
        <BrandWordmark size="header" />
        <BrandTagline className="hidden sm:block" />
      </span>
    </Link>
  );
}
