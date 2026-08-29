"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  applyThemeToDocument,
  DEFAULT_THEME,
  normalizeTheme,
  readStoredTheme,
  writeStoredTheme,
  type ScanonixTheme,
} from "@/lib/theme/theme";

interface ThemeContextValue {
  /** Resolved theme; SSR / pre-mount snapshot is always DEFAULT_THEME. */
  theme: ScanonixTheme;
  /** True after client hydration (use for theme-dependent labels later). */
  mounted: boolean;
  setTheme: (theme: ScanonixTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

type Listener = () => void;

let currentTheme: ScanonixTheme = DEFAULT_THEME;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getClientThemeSnapshot(): ScanonixTheme {
  return currentTheme;
}

function getServerThemeSnapshot(): ScanonixTheme {
  return DEFAULT_THEME;
}

function syncThemeFromStorage(): ScanonixTheme {
  const stored = readStoredTheme();
  currentTheme = stored;
  applyThemeToDocument(stored);
  return stored;
}

/** One-time client bootstrap so the store matches localStorage after paint. */
if (typeof window !== "undefined") {
  syncThemeFromStorage();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribe,
    getClientThemeSnapshot,
    getServerThemeSnapshot,
  );

  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const setTheme = useCallback((next: ScanonixTheme) => {
    const resolved = normalizeTheme(next);
    writeStoredTheme(resolved);
    applyThemeToDocument(resolved);
    currentTheme = resolved;
    emit();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "bright" ? "dark" : "bright");
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, mounted, setTheme, toggleTheme }),
    [theme, mounted, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
