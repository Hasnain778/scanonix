"use client";

import { ActionButton } from "@/components/ui/ActionButton";

interface PdfPageGridProps {
  totalPages: number;
  selectedPages: number[];
  onTogglePage: (page: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  disabled?: boolean;
}

export function PdfPageGrid({
  totalPages,
  selectedPages,
  onTogglePage,
  onSelectAll,
  onClearSelection,
  disabled = false,
}: PdfPageGridProps) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Select pages</h2>
        <div className="flex gap-2">
          <ActionButton
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={disabled}
            onClick={onSelectAll}
          >
            Select all
          </ActionButton>
          <ActionButton
            variant="ghost"
            size="sm"
            className="rounded-xl"
            disabled={disabled || selectedPages.length === 0}
            onClick={onClearSelection}
          >
            Clear
          </ActionButton>
        </div>
      </div>

      <p className="text-sm text-scanonix-muted">
        {selectedPages.length} of {totalPages} page
        {totalPages === 1 ? "" : "s"} selected
      </p>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {pages.map((page) => {
          const isSelected = selectedPages.includes(page);

          return (
            <button
              key={page}
              type="button"
              disabled={disabled}
              onClick={() => onTogglePage(page)}
              className={`group relative flex aspect-[3/4] flex-col overflow-hidden rounded-xl border transition-all duration-200 ${
                isSelected
                  ? "border-scanonix-orange bg-scanonix-orange/15 ring-2 ring-scanonix-orange/30"
                  : "border-scanonix-border bg-scanonix-surface-elevated hover:border-scanonix-orange/40"
              } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              aria-pressed={isSelected}
              aria-label={`Page ${page}${isSelected ? ", selected" : ""}`}
            >
              <div className="flex flex-1 flex-col items-center justify-center p-3">
                <div
                  className={`mb-2 flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold transition-colors ${
                    isSelected
                      ? "bg-scanonix-orange text-white"
                      : "bg-black/40 text-scanonix-muted group-hover:text-white"
                  }`}
                >
                  {page}
                </div>
                <div className="w-full space-y-1.5 px-1">
                  <div
                    className={`h-1 rounded-full ${isSelected ? "bg-scanonix-orange/60" : "bg-scanonix-border"}`}
                  />
                  <div
                    className={`h-1 w-4/5 rounded-full ${isSelected ? "bg-scanonix-orange/40" : "bg-scanonix-border/80"}`}
                  />
                  <div
                    className={`h-1 w-3/5 rounded-full ${isSelected ? "bg-scanonix-orange/30" : "bg-scanonix-border/60"}`}
                  />
                </div>
              </div>
              <div
                className={`border-t px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider ${
                  isSelected
                    ? "border-scanonix-orange/30 text-scanonix-orange"
                    : "border-scanonix-border text-scanonix-muted"
                }`}
              >
                Page {page}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
