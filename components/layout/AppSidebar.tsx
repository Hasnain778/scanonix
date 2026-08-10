"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavbarBrand } from "@/components/layout/NavbarBrand";
import { APP_NAV_ITEMS } from "@/constants/app-navigation";

function NavIcon({ type }: { type: string }) {
  const props = {
    className: "h-4 w-4 shrink-0",
    fill: "none" as const,
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.75,
    "aria-hidden": true as const,
  };

  switch (type) {
    case "dashboard":
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      );
    case "scan":
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      );
    case "history":
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "monitor":
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
      );
    case "billing":
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return null;
  }
}

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/account/settings") {
    return pathname.startsWith("/account/settings") || pathname.startsWith("/account/profile") || pathname.startsWith("/account/security") || pathname === "/account";
  }
  if (href === "/account/billing") return pathname.startsWith("/account/billing");
  if (href === "/tools/security-scan") return pathname.startsWith("/tools/security-scan");
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface AppSidebarProps {
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

export function AppSidebar({ mobileOpen = false, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();

  const navContent = (
    <nav aria-label="App navigation" className="flex flex-1 flex-col gap-0.5 p-3">
      {APP_NAV_ITEMS.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-200 ${
              active
                ? "bg-white/8 text-white"
                : "text-scanonix-muted hover:bg-white/4 hover:text-white"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                active
                  ? "bg-scanonix-orange/20 text-scanonix-orange"
                  : "text-scanonix-muted group-hover:text-scanonix-orange"
              }`}
            >
              <NavIcon type={item.icon} />
            </span>
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside className="app-sidebar hidden w-56 shrink-0 flex-col border-r border-white/6 bg-[#0a0a0a]/80 backdrop-blur-xl lg:flex">
        <div className="border-b border-white/6 p-4">
          <NavbarBrand onNavigate={onNavigate} />
        </div>
        {navContent}
      </aside>

      <div
        className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Close menu"
          onClick={onNavigate}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-[min(100%,16rem)] flex-col border-r border-white/8 bg-[#0a0a0a] shadow-premium-lg transition-transform duration-300 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="border-b border-white/6 p-4">
            <NavbarBrand onNavigate={onNavigate} />
          </div>
          {navContent}
        </aside>
      </div>
    </>
  );
}

export function AppMobileNav({ onMoreClick }: { onMoreClick: () => void }) {
  const pathname = usePathname();
  const mobileItems = APP_NAV_ITEMS.slice(0, 4);

  return (
    <nav
      aria-label="Mobile app navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-[#0a0a0a]/95 backdrop-blur-xl lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {mobileItems.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors ${
                  active ? "text-scanonix-orange" : "text-scanonix-muted"
                }`}
              >
                <NavIcon type={item.icon} />
                <span>{item.label.split(" ")[0]}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onMoreClick}
            className="flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium text-scanonix-muted"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
