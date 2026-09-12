"use client";

import { useEffect, useState } from "react";
import { renderPagePreviewDataUrl } from "@/lib/tools/pdf-to-image/pdf-render";
import { resolvePreviewNumbering } from "@/lib/tools/add-page-numbers";
import type {
  PageNumberFormat,
  PageNumberPosition,
} from "@/lib/tools/add-page-numbers/types";

interface PageNumberThumbGridProps {
  pdfBytes: ArrayBuffer;
  totalPages: number;
  numberedPages: number[];
  allPages: boolean;
  pageRangeInput: string;
  startingNumber: number;
  format: PageNumberFormat;
  position: PageNumberPosition;
  disabled?: boolean;
}

function placementClass(position: PageNumberPosition): string {
  const vertical = position.startsWith("top-") ? "top-1.5" : "bottom-1.5";
  if (position.endsWith("-left")) return `${vertical} left-1.5`;
  if (position.endsWith("-right")) return `${vertical} right-1.5`;
  return `${vertical} left-1/2 -translate-x-1/2`;
}

export function PageNumberThumbGrid({
  pdfBytes,
  totalPages,
  numberedPages,
  allPages,
  pageRangeInput,
  startingNumber,
  format,
  position,
  disabled = false,
}: PageNumberThumbGridProps) {
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
  const numberedSet = new Set(numberedPages);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Pages
        </h2>
        <p className="mt-0.5 text-xs text-scanonix-muted sm:text-sm">
          {numberedPages.length > 0
            ? `${numberedPages.length} of ${totalPages} page${
                totalPages === 1 ? "" : "s"
              } will be numbered`
            : "Configure options to number pages"}
        </p>
      </div>

      <div
        className={`grid gap-3 ${
          totalPages <= 2
            ? "grid-cols-1 sm:grid-cols-2"
            : totalPages <= 4
              ? "grid-cols-2 lg:grid-cols-4"
              : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4"
        } ${disabled ? "opacity-70" : ""}`}
      >
        {pages.map((page) => {
          const willNumber = numberedSet.has(page);
          const isLoading = loadingPages[page];
          const preview = previews[page];
          const numbering = resolvePreviewNumbering(
            allPages,
            pageRangeInput,
            totalPages,
            page - 1,
            startingNumber,
            format,
          );

          return (
            <article
              key={page}
              className={`overflow-hidden rounded-xl border bg-surface shadow-sm transition-all ${
                willNumber
                  ? "border-scanonix-orange shadow-[0_0_0_1px_color-mix(in_srgb,var(--scanonix-orange)_30%,transparent)]"
                  : "border-border"
              }`}
              aria-label={`Page ${page}${willNumber ? ", will be numbered" : ", not numbered"}`}
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
                    alt={`Page ${page} preview`}
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

                {willNumber && numbering.text && (
                  <span
                    className={`pointer-events-none absolute z-10 rounded-sm bg-scanonix-orange px-1 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm ${placementClass(position)}`}
                    aria-hidden="true"
                  >
                    {numbering.text}
                  </span>
                )}
              </div>

              <div className="border-t border-border bg-surface-muted/40 px-2.5 py-2 text-center">
                <p className="text-xs font-semibold text-foreground">
                  Page {page}
                </p>
                <p className="mt-0.5 text-[10px] text-scanonix-muted">
                  {willNumber
                    ? numbering.text
                      ? `→ ${numbering.text}`
                      : "Will be numbered"
                    : "Not numbered"}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
