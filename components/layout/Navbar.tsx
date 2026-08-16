"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSignOut } from "@/components/auth/useSignOut";
import { NavbarBrand } from "@/components/layout/NavbarBrand";
import {
  MobileNavCategories,
  NavbarCategoryDropdown,
} from "@/components/layout/NavbarCategoryDropdown";
import { UserMenu } from "@/components/layout/UserMenu";
import { BrandWordmark } from "@/components/ui/BrandWordmark";
import { ScanonixLogo } from "@/components/ui/ScanonixLogo";
import { NAV_PRICING_LINK } from "@/lib/constants";
import { PLAY_STORE_URL } from "@/config/site";

const MOBILE_FOOTER_LINKS = [
  { label: "Android App", href: PLAY_STORE_URL, external: true as const },
  { label: "Privacy", href: "/privacy", external: false as const },
  { label: "Terms", href: "/terms", external: false as const },
] as const;

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function navLinkClass(active: boolean) {
  return active ? "nav-link-premium nav-link-premium--active" : "nav-link-premium";
}

function mobileLinkClass(active: boolean) {
  return `flex min-h-[52px] items-center rounded-xl px-4 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50 ${
    active
      ? "bg-scanonix-orange/10 text-scanonix-orange"
      : "text-white hover:bg-white/5 hover:text-scanonix-orange"
  }`;
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span className="flex h-5 w-5 flex-col items-center justify-center gap-[5px]" aria-hidden="true">
      <span
        className={`block h-0.5 w-5 rounded-full bg-white transition-transform duration-200 ${
          open ? "translate-y-[7px] rotate-45" : ""
        }`}
      />
      <span
        className={`block h-0.5 w-5 rounded-full bg-white transition-opacity duration-200 ${
          open ? "opacity-0" : ""
        }`}
      />
      <span
        className={`block h-0.5 w-5 rounded-full bg-white transition-transform duration-200 ${
          open ? "-translate-y-[7px] -rotate-45" : ""
        }`}
      />
    </span>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const mounted = useMounted();
  const { isAuthenticated, loading } = useAuth();
  const signOut = useSignOut();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const pathnameRef = useRef(pathname);

  const showAuthenticated = !loading && isAuthenticated;

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setMenuOpen((open) => !open);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    setMenuOpen(false);
  }, [pathname]);

  async function handleMobileSignOut() {
    setSigningOut(true);
    closeMenu();
    try {
      await signOut("/login");
    } catch {
      setSigningOut(false);
    }
  }

  const mobileDrawer =
    mounted && menuOpen
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-[90] bg-black/70 lg:hidden"
              aria-hidden="true"
              onClick={closeMenu}
            />
            <aside
              id="mobile-navigation-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              className="fixed right-0 top-0 z-[100] flex h-dvh w-[min(88vw,380px)] flex-col border-l border-scanonix-orange/25 bg-[#0d0d0d] shadow-[-20px_0_60px_rgba(0,0,0,0.45)] lg:hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-white/10 px-5 py-5">
                <Link href="/" className="inline-flex items-center gap-2.5" onClick={closeMenu}>
                  <ScanonixLogo size={36} className="rounded-md" />
                  <BrandWordmark size="footer" />
                </Link>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                <nav className="flex flex-col gap-4" aria-label="Mobile primary">
                  {showAuthenticated ? (
                    <Link
                      href="/dashboard"
                      className={mobileLinkClass(pathname.startsWith("/dashboard"))}
                      onClick={closeMenu}
                    >
                      Dashboard
                    </Link>
                  ) : null}

                  <MobileNavCategories onNavigate={closeMenu} />

                  <Link
                    href={NAV_PRICING_LINK.href}
                    className={mobileLinkClass(pathname === NAV_PRICING_LINK.href)}
                    onClick={closeMenu}
                  >
                    {NAV_PRICING_LINK.label}
                  </Link>

                  {showAuthenticated ? (
                    <>
                      <Link
                        href="/account"
                        className={mobileLinkClass(pathname.startsWith("/account"))}
                        onClick={closeMenu}
                      >
                        Account
                      </Link>
                      <button
                        type="button"
                        disabled={signingOut}
                        onClick={() => void handleMobileSignOut()}
                        className="flex min-h-[52px] items-center rounded-xl px-4 text-left text-base font-medium text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                      >
                        {signingOut ? "Signing out…" : "Sign out"}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className={mobileLinkClass(false)}
                        onClick={closeMenu}
                      >
                        Log in
                      </Link>
                      <Link
                        href="/register"
                        className="flex min-h-[52px] items-center justify-center rounded-xl bg-scanonix-orange px-4 text-base font-semibold text-white transition-colors hover:bg-scanonix-orange-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50"
                        onClick={closeMenu}
                      >
                        Create account
                      </Link>
                    </>
                  )}
                </nav>
              </div>

              <div className="border-t border-white/10 px-4 py-4">
                <div className="flex flex-col gap-1">
                  {MOBILE_FOOTER_LINKS.map((link) =>
                    link.external ? (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-[52px] items-center rounded-xl px-4 text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
                        onClick={closeMenu}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="flex min-h-[52px] items-center rounded-xl px-4 text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
                        onClick={closeMenu}
                      >
                        {link.label}
                      </Link>
                    ),
                  )}
                </div>
              </div>
            </aside>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[var(--z-header)] transition-[background-color,border-color,box-shadow] duration-200 ${
          scrolled || menuOpen
            ? "border-b border-white/6 bg-[#0a0908]/95 shadow-[var(--shadow-xs)] backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto h-16 max-w-[1440px] px-4 sm:px-6 lg:px-8">
          {/* Mobile + tablet: logo left, hamburger right */}
          <div className="flex h-full items-center justify-between gap-2 lg:hidden">
            <Link
              href="/"
              className="inline-flex min-w-0 items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50"
              aria-label="Scanonix home"
              onClick={closeMenu}
            >
              <ScanonixLogo size={36} className="rounded-md" priority />
              <BrandWordmark size="footer" />
            </Link>

            <button
              type="button"
              className="nav-menu-trigger flex h-10 w-10 items-center justify-center"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation-panel"
              onClick={toggleMenu}
            >
              <HamburgerIcon open={menuOpen} />
            </button>
          </div>

          {/* Desktop: three-column grid */}
          <nav
            className="hidden h-full grid-cols-[1fr_auto_1fr] items-center gap-8 lg:grid"
            aria-label="Main"
          >
            <div className="flex items-center justify-start">
              <NavbarBrand onNavigate={closeMenu} />
            </div>

            <div className="flex items-center justify-center gap-1 xl:gap-1.5">
              <NavbarCategoryDropdown category="pdf" />
              <NavbarCategoryDropdown category="image" />
              <NavbarCategoryDropdown category="ai" />
              <NavbarCategoryDropdown category="security" />
              <Link
                href={NAV_PRICING_LINK.href}
                className={`rounded-lg px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40 ${navLinkClass(pathname === NAV_PRICING_LINK.href)}`}
              >
                {NAV_PRICING_LINK.label}
              </Link>
            </div>

            <div className="flex items-center justify-end gap-3">
              {showAuthenticated ? (
                <>
                  <Link
                    href="/dashboard"
                    className={`rounded-lg px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40 ${navLinkClass(pathname.startsWith("/dashboard"))}`}
                  >
                    Dashboard
                  </Link>
                  <UserMenu />
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="nav-link-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center rounded-lg bg-scanonix-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-scanonix-orange-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
                  >
                    Create account
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      {mobileDrawer}
    </>
  );
}
