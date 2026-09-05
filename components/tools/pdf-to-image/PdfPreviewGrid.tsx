"use client";

import { useEffect, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { renderPagePreviewDataUrl } from "@/lib/tools/pdf-to-image/pdf-render";

interface PdfPreviewGridProps {
  pdfBytes: ArrayBuffer;
  totalPages: number;
  selectedPages: number[];
  highlightedPages: number[];
  selectable?: boolean;
  onTogglePage?: (page: number) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  disabled?: boolean;
}

export function PdfPreviewGrid({
  pdfBytes,
  totalPages,
  selectedPages,
  highlightedPages,
  selectable = false,
  onTogglePage,
  onSelectAll,
  onClearSelection,
  disabled = false,
}: PdfPreviewGridProps) {
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [loadingPages, setLoadingPages] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadPreviews() {
      for (let page = 1; page <= totalPages; page++) {
        if (cancelled) return;

        setLoadingPages((current) => ({ ...current, [page]: true }));

        try {
          const dataUrl = await renderPagePreviewDataUrl(pdfBytes, page);
          if (!cancelled) {
            setPreviews((current) => ({ ...current, [page]: dataUrl }));
          }
        } catch {
          if (!cancelled) {
            setPreviews((current) => ({ ...current, [page]: "" }));
          }
        } finally {
          if (!cancelled) {
            setLoadingPages((current) => ({ ...current, [page]: false }));
          }
        }
      }
    }

    void loadPreviews();

    return () => {
      cancelled = true;
    };
  }, [pdfBytes, totalPages]);

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  const isHighlighted = (page: number) => {
    if (selectable) return selectedPages.includes(page);
    return highlightedPages.includes(page);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Page previews</h2>
        {selectable && (
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
        )}
      </div>

      {selectable && (
        <p className="text-sm text-scanonix-muted">
          {selectedPages.length} of {totalPages} page
          {totalPages === 1 ? "" : "s"} selected
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {pages.map((page) => {
          const highlighted = isHighlighted(page);
          const isLoading = loadingPages[page];
          const preview = previews[page];

          const content = (
            <>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <svg
                    className="h-6 w-6 animate-spin text-scanonix-orange"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                </div>
              )}
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt={`Page ${page} preview`}
                  className="h-full w-full object-contain"
                  draggable={false}
                />
              ) : (
                !isLoading && (
                  <div className="flex h-full items-center justify-center text-xs text-scanonix-muted">
                    Preview unavailable
                  </div>
                )
              )}
            </>
          );

          const cardClasses = `relative aspect-[3/4] overflow-hidden rounded-xl border bg-surface-muted transition-all duration-200 ${
            highlighted
              ? "border-scanonix-orange ring-2 ring-scanonix-orange/30"
              : "border-border"
          }`;

          if (selectable) {
            return (
              <button
                key={page}
                type="button"
                disabled={disabled}
                onClick={() => onTogglePage?.(page)}
                className={`group text-left ${cardClasses} ${
                  disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-scanonix-orange/50"
                }`}
                aria-pressed={highlighted}
                aria-label={`Page ${page}${highlighted ? ", selected" : ""}`}
              >
                {content}
                <div
                  className={`absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                    highlighted
                      ? "bg-scanonix-orange text-white"
                      : "border border-border bg-surface text-foreground"
                  }`}
                >
                  {page}
                </div>
              </button>
            );
          }

          return (
            <div key={page} className={cardClasses}>
              {content}
              <div
                className={`absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                  highlighted
                    ? "bg-scanonix-orange text-white"
                    : "border border-border bg-surface text-foreground"
                }`}
              >
                {page}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
