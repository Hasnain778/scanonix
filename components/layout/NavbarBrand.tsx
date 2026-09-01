import Link from "next/link";
import { BrandLockup } from "@/components/ui/BrandLockup";

interface NavbarBrandProps {
  onNavigate?: () => void;
  /** Sidebar uses a narrower lockup sized for `w-56` app navigation. */
  layout?: "header" | "sidebar";
}

export function NavbarBrand({ onNavigate, layout = "header" }: NavbarBrandProps) {
  const isSidebar = layout === "sidebar";

  return (
    <Link
      href="/"
      onClick={onNavigate}
      className={`group flex min-w-0 items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
        isSidebar
          ? "max-w-full shrink transition-opacity duration-200 hover:opacity-90"
          : "shrink-0 transition-transform duration-200 ease-out hover:scale-[1.015]"
      }`}
      aria-label="SCANONIX home"
    >
      <BrandLockup variant={isSidebar ? "sidebar" : "desktop"} priority decorative />
    </Link>
  );
}
