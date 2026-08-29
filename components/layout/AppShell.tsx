"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppMobileNav, AppSidebar } from "@/components/layout/AppSidebar";
import { UserMenu } from "@/components/layout/UserMenu";
import { ThemeControl } from "@/components/theme/ThemeControl";
import { BrandLockup } from "@/components/ui/BrandLockup";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:hidden">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-muted text-foreground"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <Link
              href="/"
              className="inline-flex min-w-0 flex-1 items-center overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50"
              aria-label="SCANONIX home"
            >
              <BrandLockup variant="compact" decorative />
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeControl variant="icon" />
            {!isDashboard ? <UserMenu /> : null}
          </div>
        </header>

        {!isDashboard ? (
          <div className="hidden lg:absolute lg:right-6 lg:top-5 lg:z-30 lg:flex lg:items-center lg:gap-2">
            <ThemeControl variant="icon" />
            <UserMenu />
          </div>
        ) : (
          <div className="hidden lg:absolute lg:right-6 lg:top-5 lg:z-30 lg:block">
            <ThemeControl variant="icon" />
          </div>
        )}

        <main className="flex-1 pb-20 lg:pb-10 lg:pt-8">
          <div className="page-container page-stack">{children}</div>
        </main>
      </div>

      <AppMobileNav onMoreClick={() => setMobileOpen(true)} />
    </div>
  );
}
