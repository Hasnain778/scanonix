"use client";

import type { RedactionDocumentState } from "@/lib/tools/redact-pdf/types";
import { getRedactionNavigatorItems } from "@/lib/tools/redact-pdf/workspace-ui";

interface RedactionsDrawerProps {
  open: boolean;
  state: RedactionDocumentState;
  selectedRedactionId: string | null;
  onClose: () => void;
  onNavigate: (pageIndex: number, redactionId: string) => void;
}

export function RedactionsDrawer({
  open,
  state,
  selectedRedactionId,
  onClose,
  onNavigate,
}: RedactionsDrawerProps) {
  const items = getRedactionNavigatorItems(state);

  if (!open) {
    return null;
  }

  return (
    <div
      data-redactions-drawer
      className="fixed inset-x-0 bottom-0 z-40 border-t border-scanonix-border bg-scanonix-surface p-4 shadow-2xl sm:static sm:rounded-xl sm:border sm:shadow-none"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">
          Redactions ({items.length})
        </h3>
        <button
          type="button"
          data-redactions-drawer-close
          onClick={onClose}
          className="rounded-lg border border-scanonix-border px-3 py-1.5 text-xs text-scanonix-muted hover:text-white"
        >
          Close
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-scanonix-muted">
          Draw rectangles on the PDF to add redactions.
        </p>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto">
          {items.map((item) => {
            const selected = item.id === selectedRedactionId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  data-redaction-nav-item={item.id}
                  aria-current={selected ? "true" : undefined}
                  onClick={() => {
                    onNavigate(item.pageIndex, item.id);
                    onClose();
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 ${
                    selected
                      ? "border-scanonix-orange bg-scanonix-orange/10 text-white"
                      : "border-scanonix-border bg-black/30 text-scanonix-muted hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
