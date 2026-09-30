"use client";

import { useEffect, useState } from "react";
import {
  COMPRESSION_LEVELS,
  type CompressionLevel,
} from "@/lib/tools/compress-pdf/compression-levels";
import { renderPagePreviewDataUrl } from "@/lib/tools/pdf-to-image/pdf-render";

const MAX_PREVIEW_PAGES = 8;

interface CompressDocumentOverviewProps {
  pdfBytes: ArrayBuffer;
  pageCount: number;
  fileName: string;
  level: CompressionLevel;
  isCompressing?: boolean;
  compressedSize?: number | null;
  hasResult?: boolean;
}

export function CompressDocumentOverview({
  pdfBytes,
  pageCount,
  fileName,
  level,
  isCompressing = false,
  hasResult = false,
}: CompressDocumentOverviewProps) {
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [loadingPages, setLoadingPages] = useState<Record<number, boolean>>({});

  const previewCount = Math.min(pageCount, MAX_PREVIEW_PAGES);
  const remainingPages = Math.max(0, pageCount - previewCount);
  const levelLabel = COMPRESSION_LEVELS[level].label;

  useEffect(() => {
    let cancelled = false;

    async function loadPreviews() {
      for (let page = 1; page <= previewCount; page++) {
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
  }, [pdfBytes, previewCount]);

  const pages = Array.from({ length: previewCount }, (_, index) => index + 1);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground" title={fileName}>
          {hasResult ? "Preview" : "Pages"}
        </h2>
        <p className="mt-0.5 text-xs text-scanonix-muted">
          {isCompressing
            ? "Compressing on Scanonix servers…"
            : `${pageCount} page${pageCount === 1 ? "" : "s"} · ${levelLabel}`}
        </p>
      </div>

      <div
        className={`grid gap-3 ${
          previewCount <= 1
            ? "w-[15rem] max-w-full grid-cols-1 lg:w-[26rem]"
            : previewCount <= 2
              ? "grid-cols-1 sm:grid-cols-2"
              : previewCount <= 4
                ? "grid-cols-2 lg:grid-cols-4"
                : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4"
        } ${isCompressing ? "opacity-70" : ""}`}
      >
        {pages.map((page) => {
          const isLoading = loadingPages[page];
          const preview = previews[page];

          return (
            <article
              key={page}
              className="overflow-hidden rounded-lg border border-border/80 bg-white [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#1c1917]"
              aria-label={`Page ${page} preview`}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-white">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface-muted/50">
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
                    alt={`Page ${page}`}
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                ) : (
                  !isLoading && (
                    <div className="flex h-full items-center justify-center px-2 text-center text-xs text-scanonix-muted">
                      Preview unavailable
                    </div>
                  )
                )}
              </div>
              <p className="px-2 py-1.5 text-center text-[11px] font-medium text-scanonix-muted">
                Page {page}
              </p>
            </article>
          );
        })}
      </div>

      {remainingPages > 0 && (
        <p className="text-center text-xs text-scanonix-muted">
          Showing first {previewCount} of {pageCount} pages
        </p>
      )}
    </div>
  );
}
