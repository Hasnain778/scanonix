"use client";

import { useEffect, useRef } from "react";
import {
  buildFieldsNavigatorEntries,
  getFieldsNavigatorSummary,
  type FillPdfWorkspaceState,
} from "@/lib/tools/fill-pdf";
import type { FormFieldDescriptor } from "@/lib/tools/fill-pdf/types";

interface FieldsNavigatorProps {
  open: boolean;
  fields: FormFieldDescriptor[];
  workspace: FillPdfWorkspaceState;
  onClose: () => void;
  onFieldSelect: (fieldName: string) => void;
}

function NavigatorRow({
  complete,
  label,
  required,
  hasError,
  selected,
  onClick,
}: {
  complete: boolean;
  label: string;
  required: boolean;
  hasError: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const statusIcon = complete ? "✓" : "○";
  const statusClass = complete
    ? "text-emerald-400"
    : required
      ? "text-scanonix-orange"
      : "text-scanonix-muted";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/5 ${
        selected ? "bg-scanonix-orange/10 ring-1 ring-scanonix-orange/40" : ""
      } ${hasError ? "text-red-300" : "text-white"}`}
    >
      <span className={`w-4 shrink-0 text-center font-medium ${statusClass}`} aria-hidden="true">
        {statusIcon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hasError && (
        <span className="shrink-0 text-xs text-red-300" aria-label="Has error">
          !
        </span>
      )}
    </button>
  );
}

export function FieldsNavigator({
  open,
  fields,
  workspace,
  onClose,
  onFieldSelect,
}: FieldsNavigatorProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const summary = getFieldsNavigatorSummary(fields, workspace.editState);
  const entries = buildFieldsNavigatorEntries(
    fields,
    workspace.editState,
    workspace.fieldErrors,
  );

  useEffect(() => {
    if (!open || !workspace.selectedFieldName) {
      return;
    }

    const selected = listRef.current?.querySelector(
      `[data-nav-field="${CSS.escape(workspace.selectedFieldName)}"]`,
    );
    selected?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open, workspace.selectedFieldName]);

  if (!open) {
    return null;
  }

  const handleSelect = (fieldName: string) => {
    onFieldSelect(fieldName);
    onClose();
  };

  const panelContent = (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-scanonix-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Fields</h2>
          <p className="mt-0.5 text-xs text-scanonix-muted">
            {summary.completed}/{summary.total} completed
            {summary.requiredRemaining > 0
              ? ` · ${summary.requiredRemaining} required remaining`
              : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-scanonix-muted transition hover:bg-white/5 hover:text-white"
          aria-label="Close fields navigator"
        >
          ✕
        </button>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-2 py-2">
        {entries.length === 0 ? (
          <p className="px-3 py-4 text-sm text-scanonix-muted">No editable fields.</p>
        ) : (
          <nav aria-label="Form fields">
            <ul className="space-y-0.5">
              {entries.map((entry) => (
                <li key={entry.key} data-nav-field={entry.fieldName}>
                  <NavigatorRow
                    complete={entry.complete}
                    label={entry.label}
                    required={entry.required}
                    hasError={entry.hasError}
                    selected={workspace.selectedFieldName === entry.fieldName}
                    onClick={() => handleSelect(entry.fieldName)}
                  />
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        aria-label="Close fields navigator"
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] lg:bg-black/40"
        onClick={onClose}
      />

      {/* Desktop: right drawer */}
      <aside
        data-fill-pdf-fields-navigator
        className="fixed inset-y-0 right-0 z-50 hidden w-full max-w-xs flex-col border-l border-scanonix-border bg-[#0d1117]/98 shadow-2xl backdrop-blur-xl lg:flex"
        aria-label="Fields navigator"
      >
        {panelContent}
      </aside>

      {/* Mobile: bottom sheet */}
      <aside
        data-fill-pdf-fields-navigator-mobile
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[min(70vh,28rem)] flex-col rounded-t-2xl border-t border-scanonix-border bg-[#0d1117]/98 shadow-2xl backdrop-blur-xl lg:hidden"
        aria-label="Fields navigator"
      >
        {panelContent}
      </aside>
    </>
  );
}
