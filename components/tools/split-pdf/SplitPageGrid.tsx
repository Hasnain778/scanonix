"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { renderPagePreviewDataUrl } from "@/lib/tools/pdf-to-image/pdf-render";
import type { SplitMode } from "@/lib/tools/types";

/** Small PDFs load every page eagerly — no lazy/concurrency races. */
const SMALL_DOC_PAGE_LIMIT = 24;
/** Concurrent PDF.js renders for larger documents only. */
const LARGE_DOC_CONCURRENCY = 3;

interface SplitPageGridProps {
  pdfBytes: ArrayBuffer;
  totalPages: number;
  mode: SplitMode;
  selectedPages: number[];
  /** Planned output groups from existing split builders (1-based page numbers). */
  pageGroups: number[][];
  groupsError?: string;
  selectable?: boolean;
  onTogglePage?: (page: number) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  disabled?: boolean;
}

function buildPageGroupIndex(groups: number[][]): Map<number, number> {
  const map = new Map<number, number>();
  groups.forEach((group, groupIndex) => {
    for (const page of group) {
      if (!map.has(page)) {
        map.set(page, groupIndex + 1);
      }
    }
  });
  return map;
}

async function renderPreviewSafely(
  pdfBytes: ArrayBuffer,
  page: number,
): Promise<string> {
  try {
    return await renderPagePreviewDataUrl(pdfBytes, page);
  } catch {
    return "";
  }
}

export function SplitPageGrid({
  pdfBytes,
  totalPages,
  mode,
  selectedPages,
  pageGroups,
  groupsError,
  selectable = false,
  onTogglePage,
  onSelectAll,
  onClearSelection,
  disabled = false,
}: SplitPageGridProps) {
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [loadingPages, setLoadingPages] = useState<Record<number, boolean>>({});
  const loadGenerationRef = useRef(0);

  const groupIndexByPage = useMemo(
    () => (groupsError ? new Map<number, number>() : buildPageGroupIndex(pageGroups)),
    [pageGroups, groupsError],
  );

  const includedPages = useMemo(() => {
    if (selectable) {
      return new Set(selectedPages);
    }
    return new Set(groupIndexByPage.keys());
  }, [selectable, selectedPages, groupIndexByPage]);

  const pages = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1),
    [totalPages],
  );

  useEffect(() => {
    const generation = ++loadGenerationRef.current;
    let cancelled = false;

    const isCurrent = () =>
      !cancelled && generation === loadGenerationRef.current;

    async function loadSequential() {
      setPreviews({});
      setLoadingPages({});

      for (const page of pages) {
        if (!isCurrent()) return;

        setLoadingPages((current) => ({ ...current, [page]: true }));
        const dataUrl = await renderPreviewSafely(pdfBytes, page);

        if (!isCurrent()) {
          setLoadingPages((current) => ({ ...current, [page]: false }));
          return;
        }

        setPreviews((current) => ({ ...current, [page]: dataUrl }));
        setLoadingPages((current) => ({ ...current, [page]: false }));
      }
    }

    async function loadBoundedConcurrent() {
      setPreviews({});
      setLoadingPages(
        Object.fromEntries(pages.map((page) => [page, true])) as Record<
          number,
          boolean
        >,
      );

      let nextIndex = 0;

      async function worker() {
        while (isCurrent()) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= pages.length) return;

          const page = pages[index];
          const dataUrl = await renderPreviewSafely(pdfBytes, page);

          if (!isCurrent()) {
            setLoadingPages((current) => ({ ...current, [page]: false }));
            return;
          }

          setPreviews((current) => ({ ...current, [page]: dataUrl }));
          setLoadingPages((current) => ({ ...current, [page]: false }));
        }
      }

      const workerCount = Math.min(LARGE_DOC_CONCURRENCY, pages.length);
      await Promise.all(
        Array.from({ length: workerCount }, () => worker()),
      );

      // If this generation was cancelled mid-flight, force-clear any leftover spinners.
      if (!isCurrent()) {
        setLoadingPages({});
      }
    }

    void (totalPages <= SMALL_DOC_PAGE_LIMIT
      ? loadSequential()
      : loadBoundedConcurrent());

    return () => {
      cancelled = true;
    };
  }, [pdfBytes, totalPages, pages]);

  const subtitle = (() => {
    if (selectable) {
      return `${selectedPages.length} of ${totalPages} page${
        totalPages === 1 ? "" : "s"
      } selected · one output PDF`;
    }
    if (groupsError) {
      return groupsError;
    }
    const fileCount = pageGroups.length;
    const pageCount = includedPages.size;
    return `${pageCount} of ${totalPages} page${
      totalPages === 1 ? "" : "s"
    } included · ${fileCount} output file${fileCount === 1 ? "" : "s"}`;
  })();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Pages
          </h2>
          <p className="mt-0.5 text-xs text-scanonix-muted sm:text-sm">
            {subtitle}
          </p>
        </div>
        {selectable && (
          <div className="flex gap-2">
            <ActionButton
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={disabled}
              onClick={onSelectAll}
            >
              Select all
            </ActionButton>
            <ActionButton
              variant="ghost"
              size="sm"
              className="rounded-lg"
              disabled={disabled || selectedPages.length === 0}
              onClick={onClearSelection}
            >
              Clear
            </ActionButton>
          </div>
        )}
      </div>

      <div
        className={`grid gap-3 ${
          totalPages <= 2
            ? "grid-cols-1 sm:grid-cols-2"
            : totalPages <= 4
              ? "grid-cols-2 lg:grid-cols-4"
              : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4"
        }`}
      >
        {pages.map((page) => {
          const included = includedPages.has(page);
          const groupIndex = groupIndexByPage.get(page);
          const isLoading = Boolean(loadingPages[page]);
          const preview = previews[page];
          const failed = preview === "";
          const showGroupBadge =
            !selectable &&
            included &&
            typeof groupIndex === "number" &&
            (mode === "ranges" ||
              mode === "every-page" ||
              mode === "fixed-interval");

          const cardClasses = `relative overflow-hidden rounded-xl border shadow-sm transition-all ${
            included
              ? "border-scanonix-orange shadow-[0_0_0_1px_color-mix(in_srgb,var(--scanonix-orange)_30%,transparent)]"
              : "border-border opacity-55"
          }`;

          const body = (
            <>
              <div className="relative aspect-[3/4] overflow-hidden bg-white">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface-muted/40">
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
                {!isLoading && preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt={`Page ${page} preview`}
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                ) : null}
                {!isLoading && failed ? (
                  <div className="flex h-full items-center justify-center bg-white px-2 text-center text-xs text-scanonix-muted">
                    Preview unavailable
                  </div>
                ) : null}
              </div>

              <div
                className={`absolute left-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-[11px] font-bold tabular-nums ${
                  included
                    ? "bg-scanonix-orange text-white"
                    : "border border-border bg-surface/95 text-foreground"
                }`}
              >
                {page}
              </div>

              {showGroupBadge && (
                <div className="absolute bottom-1.5 right-1.5 rounded-md border border-scanonix-orange/40 bg-scanonix-orange/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-scanonix-orange">
                  File {groupIndex}
                </div>
              )}
            </>
          );

          if (selectable) {
            return (
              <button
                key={page}
                type="button"
                data-split-page={page}
                disabled={disabled}
                onClick={() => onTogglePage?.(page)}
                className={`group text-left ${cardClasses} ${
                  disabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer"
                }`}
                aria-pressed={included}
                aria-label={`Page ${page}${included ? ", selected" : ""}`}
              >
                {body}
              </button>
            );
          }

          return (
            <article
              key={page}
              data-split-page={page}
              className={cardClasses}
              aria-label={`Page ${page}${
                included
                  ? groupIndex
                    ? `, output file ${groupIndex}`
                    : ", included"
                  : ", not included"
              }`}
            >
              {body}
            </article>
          );
        })}
      </div>
    </div>
  );
}
