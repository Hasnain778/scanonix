"use client";

import { useEffect, useState } from "react";
import { FileArchive } from "lucide-react";
import {
  calculateSavingsPercent,
  COMPRESSION_LEVELS,
  type CompressionLevel,
} from "@/lib/tools/compress-pdf/compression-levels";
import { formatFileSize } from "@/lib/tools/format-utils";
import { renderPagePreviewDataUrl } from "@/lib/tools/pdf-to-image/pdf-render";

const MAX_PREVIEW_PAGES = 8;

interface CompressDocumentOverviewProps {
  pdfBytes: ArrayBuffer;
  pageCount: number;
  fileName: string;
  originalSize: number;
  level: CompressionLevel;
  isCompressing?: boolean;
  compressedSize?: number | null;
  hasResult?: boolean;
}

export function CompressDocumentOverview({
  pdfBytes,
  pageCount,
  fileName,
  originalSize,
  level,
  isCompressing = false,
  compressedSize = null,
  hasResult = false,
}: CompressDocumentOverviewProps) {
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [loadingPages, setLoadingPages] = useState<Record<number, boolean>>({});

  const previewCount = Math.min(pageCount, MAX_PREVIEW_PAGES);
  const remainingPages = Math.max(0, pageCount - previewCount);
  const levelLabel = COMPRESSION_LEVELS[level].label;
  const savings =
    hasResult && compressedSize != null
      ? calculateSavingsPercent(originalSize, compressedSize)
      : null;

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {hasResult ? "Compression result" : "Document"}
          </h2>
          <p className="mt-0.5 text-xs text-scanonix-muted sm:text-sm">
            {hasResult
              ? "Your compressed PDF is ready to download."
              : isCompressing
                ? "Compressing on Scanonix servers…"
                : `${pageCount} page${pageCount === 1 ? "" : "s"} · ${levelLabel}`}
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
          <FileArchive className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>

      {hasResult && compressedSize != null && (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface-muted/70 px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
              Original
            </p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {formatFileSize(originalSize)}
            </p>
          </div>
          <div className="rounded-xl border border-scanonix-orange/40 bg-scanonix-orange/10 px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-scanonix-orange">
              Compressed
            </p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {formatFileSize(compressedSize)}
            </p>
          </div>
          <div
            className={`rounded-xl border px-3 py-3 ${
              savings != null && savings > 0
                ? "border-green-500/30 bg-green-500/10"
                : "border-border bg-surface-muted/70"
            }`}
          >
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.08em] ${
                savings != null && savings > 0
                  ? "text-green-700 dark:text-green-400"
                  : "text-scanonix-muted"
              }`}
            >
              Saved
            </p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {savings != null && savings > 0 ? `${savings}%` : "No reduction"}
            </p>
          </div>
        </div>
      )}

      {!hasResult && (
        <div className="rounded-xl border border-border bg-surface-muted/50 px-3 py-3 text-sm">
          <p className="truncate font-semibold text-foreground" title={fileName}>
            {fileName}
          </p>
          <p className="mt-1 text-xs text-scanonix-muted">
            {formatFileSize(originalSize)} · Selected: {levelLabel}
            {isCompressing ? " · In progress" : ""}
          </p>
        </div>
      )}

      <div
        className={`grid gap-3 ${
          previewCount <= 2
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
              className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
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
              <div className="border-t border-border bg-surface-muted/40 px-2.5 py-2 text-center">
                <p className="text-xs font-semibold text-foreground">Page {page}</p>
              </div>
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
