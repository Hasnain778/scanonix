"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppMobileNav, AppSidebar } from "@/components/layout/AppSidebar";
import { UserMenu } from "@/components/layout/UserMenu";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";

  return (
    <div className="flex min-h-screen">
      <AppSidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/6 bg-[#0a0a0a]/80 px-4 backdrop-blur-xl lg:hidden">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          {!isDashboard ? <UserMenu /> : null}
        </header>

        {!isDashboard ? (
          <div className="hidden lg:absolute lg:right-6 lg:top-5 lg:z-30 lg:block">
            <UserMenu />
          </div>
        ) : null}

        <main className="flex-1 pb-20 lg:pb-10 lg:pt-8">
          <div className="page-container page-stack">{children}</div>
        </main>
      </div>

      <AppMobileNav onMoreClick={() => setMobileOpen(true)} />
    </div>
  );
}
