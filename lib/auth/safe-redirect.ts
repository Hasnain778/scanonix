const DEFAULT_REDIRECT = "/dashboard";

/**
 * Returns a same-origin relative path safe for post-auth redirects.
 * Rejects protocol-relative URLs (//evil.com) and absolute URLs.
 */
export function getSafeRedirectPath(
  path: string | null | undefined,
  fallback = DEFAULT_REDIRECT,
): string {
  if (!path) {
    return fallback;
  }

  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(trimmed, "http://localhost");
    if (url.origin !== "http://localhost") {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
