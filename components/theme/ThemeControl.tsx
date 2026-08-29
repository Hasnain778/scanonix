"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

type ThemeControlVariant = "icon" | "row";

interface ThemeControlProps {
  variant?: ThemeControlVariant;
  className?: string;
  /** Optional callback after toggle (e.g. close mobile drawer). */
  onToggle?: () => void;
}

/**
 * Shared Dark/Bright theme control.
 * Hydration-safe: until mounted, uses a neutral label/icon (no wrong-theme claim).
 */
export function ThemeControl({
  variant = "icon",
  className = "",
  onToggle,
}: ThemeControlProps) {
  const { theme, mounted, toggleTheme } = useTheme();

  const label = !mounted
    ? "Toggle color theme"
    : theme === "dark"
      ? "Switch to Bright theme"
      : "Switch to Dark theme";

  const Icon = !mounted ? SunMoon : theme === "dark" ? Sun : Moon;

  function handleClick() {
    toggleTheme();
    onToggle?.();
  }

  if (variant === "row") {
    const status = !mounted ? "…" : theme === "dark" ? "Dark" : "Bright";
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl px-4 text-left text-base font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50 ${className}`}
      >
        <span className="inline-flex items-center gap-3">
          <Icon className="h-4 w-4 shrink-0 text-scanonix-orange" aria-hidden="true" />
          <span>Theme</span>
        </span>
        <span className="text-sm font-medium text-foreground-muted" aria-hidden={!mounted}>
          {status}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface/60 text-foreground transition-colors hover:border-scanonix-orange/40 hover:bg-surface-muted hover:text-scanonix-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50 ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
