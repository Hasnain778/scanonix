import Link from "next/link";
import { BrandLockup } from "@/components/ui/BrandLockup";

interface NavbarBrandProps {
  onNavigate?: () => void;
}

export function NavbarBrand({ onNavigate }: NavbarBrandProps) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className="group flex min-w-0 shrink-0 items-center rounded-xl outline-none transition-transform duration-200 ease-out hover:scale-[1.015] focus-visible:ring-2 focus-visible:ring-scanonix-orange/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      aria-label="SCANONIX home"
    >
      <BrandLockup variant="desktop" priority decorative />
    </Link>
  );
}
