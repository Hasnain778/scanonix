"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSignOut } from "@/components/auth/useSignOut";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { getDisplayName } from "@/lib/auth/display";

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function UserMenu() {
  const { user, profile, loading, isAuthenticated } = useAuth();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const hydrated = useHydrated();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!hydrated || loading) {
    return (
      <div
        className="h-10 w-10 animate-pulse rounded-xl bg-white/10"
        aria-hidden="true"
      />
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const email = user.email ?? "";
  const displayName = getDisplayName(user, profile);

  async function handleSignOut() {
    setSigningOut(true);
    setOpen(false);
    try {
      await signOut("/login");
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 transition-colors hover:border-scanonix-orange/40"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <UserAvatar user={user} profile={profile} size={32} className="rounded-lg" />
        <span className="hidden max-w-[8rem] truncate text-sm font-medium text-white sm:inline">
          {displayName}
        </span>
        <svg
          className={`h-4 w-4 text-scanonix-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-scanonix-surface shadow-xl"
        >
          <div className="border-b border-white/10 px-4 py-3">
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <p className="truncate text-xs text-scanonix-muted">{email}</p>
          </div>
          <div className="py-1">
            <Link
              href="/dashboard"
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/5 hover:text-scanonix-orange"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/monitors"
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/5 hover:text-scanonix-orange"
              onClick={() => setOpen(false)}
            >
              Monitors
            </Link>
            <Link
              href="/scan-history"
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/5 hover:text-scanonix-orange"
              onClick={() => setOpen(false)}
            >
              Scan History
            </Link>
            <Link
              href="/account"
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/5 hover:text-scanonix-orange"
              onClick={() => setOpen(false)}
            >
              Account
            </Link>
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={handleSignOut}
              className="block w-full px-4 py-2.5 text-left text-sm text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AuthNavLinks({
  onNavigate,
  mobile = false,
}: {
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const { isAuthenticated, loading } = useAuth();
  const hydrated = useHydrated();

  const loginClass = mobile
    ? "rounded-xl px-4 py-3.5 text-lg font-medium text-white transition-colors hover:bg-white/5 hover:text-scanonix-orange"
    : "rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/5 hover:text-white";

  const registerClass = mobile
    ? "mt-2 inline-flex w-full items-center justify-center rounded-xl bg-scanonix-orange px-6 py-3.5 text-base font-semibold text-white"
    : "inline-flex items-center justify-center rounded-xl bg-scanonix-orange px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-scanonix-orange-light";

  if (hydrated && !loading && isAuthenticated) {
    const linkClass = mobile
      ? "rounded-xl px-4 py-3.5 text-lg font-medium text-white transition-colors hover:bg-white/5 hover:text-scanonix-orange"
      : "rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/5 hover:text-white";

    return (
      <>
        <Link href="/dashboard" className={linkClass} onClick={onNavigate}>
          Dashboard
        </Link>
        <Link href="/monitors" className={linkClass} onClick={onNavigate}>
          Monitors
        </Link>
        <Link href="/scan-history" className={linkClass} onClick={onNavigate}>
          Scan History
        </Link>
        <Link href="/account" className={linkClass} onClick={onNavigate}>
          Account
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className={loginClass} onClick={onNavigate}>
        Log in
      </Link>
      <Link href="/register" className={registerClass} onClick={onNavigate}>
        Create account
      </Link>
    </>
  );
}
