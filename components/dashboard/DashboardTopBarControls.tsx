"use client";

import Link from "next/link";
import { UserMenu } from "@/components/layout/UserMenu";

function IconButton({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/4 text-scanonix-muted transition-all hover:border-white/14 hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50"
      aria-label={label}
    >
      {children}
    </Link>
  );
}

export function DashboardTopBarControls() {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <IconButton href="/account/settings" label="Notification settings">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
      </IconButton>
      <UserMenu />
    </div>
  );
}
