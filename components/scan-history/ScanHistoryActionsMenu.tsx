"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import type { ScanHistoryRecord } from "@/lib/scan-history/types";
import {
  closeActionsMenu,
  getOpenActionsMenuId,
  setOpenActionsMenuId,
  subscribeOpenActionsMenu,
} from "@/components/scan-history/actions-menu-state";

interface ScanHistoryActionsMenuProps {
  scan: ScanHistoryRecord;
  premiumUnlocked: boolean;
  onDownloadJson: (scan: ScanHistoryRecord) => void;
  onDownloadPdf: (scan: ScanHistoryRecord) => void;
  onDelete: (scan: ScanHistoryRecord) => void;
  busy?: boolean;
}

const MENU_WIDTH = 208;
const MENU_GAP = 8;
const VIEWPORT_PADDING = 8;
const MENU_ITEM_COUNT = 5;
const MENU_ITEM_HEIGHT = 42;
const MENU_PADDING = 8;
const ESTIMATED_MENU_HEIGHT = MENU_ITEM_COUNT * MENU_ITEM_HEIGHT + MENU_PADDING;

interface MenuPosition {
  top: number;
  left: number;
  placement: "above" | "below";
}

function computeMenuPosition(button: HTMLButtonElement, menuHeight: number): MenuPosition {
  const rect = button.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
  const spaceAbove = rect.top - VIEWPORT_PADDING;
  const placement =
    spaceBelow >= menuHeight + MENU_GAP || spaceBelow >= spaceAbove ? "below" : "above";

  let top =
    placement === "below"
      ? rect.bottom + MENU_GAP
      : rect.top - menuHeight - MENU_GAP;

  let left = rect.right - MENU_WIDTH;
  left = Math.max(
    VIEWPORT_PADDING,
    Math.min(left, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING),
  );
  top = Math.max(
    VIEWPORT_PADDING,
    Math.min(top, window.innerHeight - menuHeight - VIEWPORT_PADDING),
  );

  return { top, left, placement };
}

function useActionsMenuOpen(menuId: string) {
  const openMenuId = useSyncExternalStore(
    subscribeOpenActionsMenu,
    getOpenActionsMenuId,
    () => null,
  );

  return {
    open: openMenuId === menuId,
    setOpen: (next: boolean) => setOpenActionsMenuId(next ? menuId : null),
  };
}

export function ScanHistoryActionsMenu({
  scan,
  premiumUnlocked,
  onDownloadJson,
  onDownloadPdf,
  onDelete,
  busy = false,
}: ScanHistoryActionsMenuProps) {
  const menuId = `scan-actions-${scan.id}`;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { open, setOpen } = useActionsMenuOpen(scan.id);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const closeMenu = useCallback(() => setOpen(false), [setOpen]);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const measuredHeight = menuRef.current?.offsetHeight ?? ESTIMATED_MENU_HEIGHT;
    setMenuPosition(computeMenuPosition(buttonRef.current, measuredHeight));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frame);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
        buttonRef.current?.focus();
      }
    }

    function handleDismiss() {
      closeMenu();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
    };
  }, [closeMenu, open]);

  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    const firstItem = menuRef.current.querySelector<HTMLElement>('[role="menuitem"]');
    firstItem?.focus();
  }, [open]);

  const menuStyle = menuPosition
    ? {
        top: menuPosition.top,
        left: menuPosition.left,
      }
    : undefined;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Actions for scan ${scan.target}`}
        disabled={busy}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }

          if (buttonRef.current) {
            setMenuPosition(
              computeMenuPosition(buttonRef.current, ESTIMATED_MENU_HEIGHT),
            );
          }
          setOpen(true);
        }}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:border-scanonix-orange/40 focus:outline-none focus:ring-2 focus:ring-scanonix-orange/50 disabled:opacity-50"
      >
        Actions
      </button>

      {mounted && open && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              style={menuStyle}
              className={`animate-fade-in fixed z-[90] w-52 overflow-hidden rounded-xl border border-white/10 bg-scanonix-surface shadow-xl ${
                menuPosition.placement === "above" ? "origin-bottom-right" : "origin-top-right"
              }`}
            >
              <MenuLink
                href={`/scan-results/${scan.id}`}
                label="View Report"
                onNavigate={closeMenu}
              />
              <MenuButton
                label={premiumUnlocked ? "Download PDF" : "Download PDF (Pro)"}
                onClick={() => {
                  closeMenu();
                  onDownloadPdf(scan);
                }}
              />
              <MenuButton
                label={premiumUnlocked ? "Download JSON" : "Download JSON (Pro)"}
                onClick={() => {
                  closeMenu();
                  onDownloadJson(scan);
                }}
              />
              <MenuLink
                href={`/tools/security-scan?target=${encodeURIComponent(scan.target)}&type=${scan.targetType}`}
                label="Re-run Scan"
                onNavigate={closeMenu}
              />
              <MenuButton
                label="Delete"
                destructive
                onClick={() => {
                  closeMenu();
                  onDelete(scan);
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function MenuLink({
  href,
  label,
  onNavigate,
}: {
  href: string;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      tabIndex={-1}
      onClick={onNavigate}
      className="block w-full px-4 py-2.5 text-left text-sm text-white transition-colors hover:bg-white/5 hover:text-scanonix-orange focus:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-scanonix-orange/60"
    >
      {label}
    </Link>
  );
}

function MenuButton({
  label,
  onClick,
  destructive = false,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      className={`block w-full px-4 py-2.5 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-scanonix-orange/60 ${
        destructive
          ? "text-red-300 hover:bg-red-500/10"
          : "text-white hover:bg-white/5 hover:text-scanonix-orange"
      }`}
    >
      {label}
    </button>
  );
}

export { closeActionsMenu };
