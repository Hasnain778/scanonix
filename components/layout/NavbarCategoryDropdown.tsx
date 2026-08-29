"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { NAV_DROPDOWN_TOOLS, type HomepageToolCategory } from "@/constants/homepage-tools";

const NAV_ORDER: HomepageToolCategory[] = ["pdf", "image", "ai", "security"];

interface NavbarCategoryDropdownProps {
  category: HomepageToolCategory;
  onNavigate?: () => void;
}

export function NavbarCategoryDropdown({ category, onNavigate }: NavbarCategoryDropdownProps) {
  const menu = NAV_DROPDOWN_TOOLS[category];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [close]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="nav-link-premium inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        {menu.label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-[var(--z-dropdown)] mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface/95 py-1.5 shadow-[var(--shadow-raised)] backdrop-blur-md">
          <ul>
            {menu.tools.map((tool) => (
              <li key={tool.href}>
                <Link
                  href={tool.href}
                  className="block px-3.5 py-2 text-sm text-foreground-secondary transition-colors hover:bg-brand-soft hover:text-foreground focus-visible:outline-none focus-visible:bg-brand-soft"
                  onClick={() => {
                    close();
                    onNavigate?.();
                  }}
                >
                  {tool.name}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-border pt-1">
            <Link
              href={menu.viewAllHref}
              className="block px-3.5 py-2 text-sm font-semibold text-scanonix-orange transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:bg-brand-soft"
              onClick={() => {
                close();
                onNavigate?.();
              }}
            >
              View all {menu.label.toLowerCase()}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MobileNavCategories({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      {NAV_ORDER.map((category) => {
        const menu = NAV_DROPDOWN_TOOLS[category];
        return (
          <div key={category}>
            <p className="px-4 text-xs font-semibold uppercase tracking-wide text-scanonix-muted">
              {menu.label}
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {menu.tools.map((tool) => (
                <li key={tool.href}>
                  <Link
                    href={tool.href}
                    className="flex min-h-[48px] items-center rounded-xl px-4 text-base font-medium text-foreground transition-colors hover:bg-surface-muted hover:text-scanonix-orange"
                    onClick={onNavigate}
                  >
                    {tool.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={menu.viewAllHref}
                  className="flex min-h-[48px] items-center rounded-xl px-4 text-sm font-medium text-scanonix-orange"
                  onClick={onNavigate}
                >
                  View all {menu.label.toLowerCase()}
                </Link>
              </li>
            </ul>
          </div>
        );
      })}
    </div>
  );
}
