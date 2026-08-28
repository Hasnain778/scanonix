"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Coordinates mobile sticky tool action bars with overlays (ToolFinder FAB).
 * Sticky bars publish measured height while mounted/visible; consumers read inset.
 */
type MobileStickyActionSurfaceValue = {
  /** Pixels reserved at the bottom by a visible mobile sticky action bar (0 when absent). */
  insetBottomPx: number;
  setInsetBottomPx: (px: number) => void;
};

const MobileStickyActionSurfaceContext =
  createContext<MobileStickyActionSurfaceValue | null>(null);

export { MobileStickyActionSurfaceContext };

const CSS_VAR = "--scanonix-sticky-action-inset";

export function MobileStickyActionSurfaceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [insetBottomPx, setInsetBottomPxState] = useState(0);

  const setInsetBottomPx = useCallback((px: number) => {
    const next = Number.isFinite(px) && px > 0 ? Math.ceil(px) : 0;
    setInsetBottomPxState(next);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty(CSS_VAR, `${insetBottomPx}px`);
    return () => {
      document.documentElement.style.removeProperty(CSS_VAR);
    };
  }, [insetBottomPx]);

  const value = useMemo(
    () => ({ insetBottomPx, setInsetBottomPx }),
    [insetBottomPx, setInsetBottomPx],
  );

  return (
    <MobileStickyActionSurfaceContext.Provider value={value}>
      {children}
    </MobileStickyActionSurfaceContext.Provider>
  );
}

export function useMobileStickyActionInset(): number {
  const ctx = useContext(MobileStickyActionSurfaceContext);
  return ctx?.insetBottomPx ?? 0;
}

/**
 * Publishes sticky bar height while `active`. Clears on unmount or when inactive.
 * Safe when provider is missing (no-op) so unit/isolation usage does not crash.
 *
 * Prefer measuring + publishing from the sticky bar's useLayoutEffect so the
 * FAB offset updates before paint; this hook remains for simple cases.
 */
export function useRegisterMobileStickyActionSurface(
  active: boolean,
  heightPx: number,
): void {
  const ctx = useContext(MobileStickyActionSurfaceContext);

  useEffect(() => {
    if (!ctx) return;
    if (!active || heightPx <= 0) {
      ctx.setInsetBottomPx(0);
      return;
    }
    ctx.setInsetBottomPx(heightPx);
    return () => {
      ctx.setInsetBottomPx(0);
    };
  }, [active, heightPx, ctx]);
}

/** CSS custom property name mirrored onto :root for layout consumers. */
export const MOBILE_STICKY_ACTION_INSET_CSS_VAR = CSS_VAR;
