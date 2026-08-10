"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/account/profile", label: "Profile" },
  { href: "/account/billing", label: "Billing" },
  { href: "/account/security", label: "Security" },
  { href: "/account/settings", label: "Settings" },
] as const;

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account sections" className="surface-card rounded-2xl p-2 lg:sticky lg:top-28">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/account/profile" && pathname === "/account");

          return (
            <li key={item.href} className="shrink-0 lg:shrink">
              <Link
                href={item.href}
                className={`block whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50 ${
                  isActive
                    ? "bg-white/8 text-white"
                    : "text-scanonix-muted hover:bg-white/4 hover:text-white"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
