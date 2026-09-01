"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ActionButton } from "@/components/ui/ActionButton";
import type { ScanHistoryRecord } from "@/lib/scan-history/types";

interface ScanHistoryDeleteDialogProps {
  scan: ScanHistoryRecord | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ScanHistoryDeleteDialog({
  scan,
  loading = false,
  onCancel,
  onConfirm,
}: ScanHistoryDeleteDialogProps) {
  const mounted = useMounted();

  useEffect(() => {
    if (!scan) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [loading, onCancel, scan]);

  if (!scan || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
      role="presentation"
      onClick={loading ? undefined : onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-scan-title"
        aria-describedby="delete-scan-description"
        className="animate-fade-in w-full max-w-md rounded-2xl border border-border bg-scanonix-surface p-6 shadow-premium-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-scan-title" className="text-xl font-semibold text-foreground">
          Delete scan?
        </h2>
        <p id="delete-scan-description" className="mt-3 text-sm leading-relaxed text-scanonix-muted">
          This will permanently remove the scan for{" "}
          <span className="font-medium text-foreground">{scan.target}</span>. This action cannot be
          undone.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <ActionButton variant="outline" disabled={loading} onClick={onCancel}>
            Cancel
          </ActionButton>
          <ActionButton
            loading={loading}
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-500"
          >
            Delete scan
          </ActionButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
