"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ActionButton } from "@/components/ui/ActionButton";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  destructive?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  destructive = false,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && dialog?.open) {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-auto max-h-[min(90vh,40rem)] w-[min(calc(100%-2rem),28rem)] overflow-hidden rounded-2xl border border-white/10 bg-scanonix-surface p-0 text-white shadow-2xl backdrop:bg-black/70 open:flex open:flex-col"
      aria-labelledby="dialog-title"
    >
      <div className="border-b border-white/10 px-6 py-5">
        <h2 id="dialog-title" className="text-section-title">
          {title}
        </h2>
        {description ? <p className="text-body mt-2">{description}</p> : null}
      </div>
      {children ? <div className="overflow-y-auto px-6 py-4">{children}</div> : null}
      <div className="flex flex-col-reverse gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:justify-end">
        <ActionButton variant="ghost" onClick={onClose}>
          {cancelLabel}
        </ActionButton>
        {onConfirm ? (
          <ActionButton
            variant={destructive ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </ActionButton>
        ) : null}
      </div>
    </dialog>
  );
}
