"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/scans", label: "Scans" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/monitoring", label: "Monitoring" },
  { href: "/admin/system", label: "System" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="glass-card rounded-2xl p-3 shadow-premium" aria-label="Admin navigation">
      <ul className="space-y-1">
        {NAV_ITEMS.map(({ href, label, ...item }) => {
          const exact = "exact" in item && item.exact;
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-scanonix-orange text-white shadow-lg shadow-scanonix-orange/20"
                    : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
