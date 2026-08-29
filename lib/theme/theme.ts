/**
 * Scanonix theme contract — Dark / Bright only.
 * Storage key: scanonix-theme
 */

export const THEME_STORAGE_KEY = "scanonix-theme" as const;

export const THEME_VALUES = ["dark", "bright"] as const;

export type ScanonixTheme = (typeof THEME_VALUES)[number];

export const DEFAULT_THEME: ScanonixTheme = "dark";

export function isScanonixTheme(value: unknown): value is ScanonixTheme {
  return value === "dark" || value === "bright";
}

export function normalizeTheme(value: unknown): ScanonixTheme {
  return isScanonixTheme(value) ? value : DEFAULT_THEME;
}

/** Apply theme to the document root (client only). */
export function applyThemeToDocument(theme: ScanonixTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export function readStoredTheme(): ScanonixTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeStoredTheme(theme: ScanonixTheme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode / quota — ignore */
  }
}

/**
 * Synchronous pre-paint boot (inline in root layout).
 * Keep tiny, dependency-free, failure-safe to dark.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t!=="dark"&&t!=="bright")t="dark";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;
