"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import {
  canDeletePage,
  canMovePageEarlier,
  canMovePageFirst,
  canMovePageLast,
  canMovePageLater,
  getDisplayPageNumber,
  getPageThumbnailSignature,
} from "@/lib/tools/organize-pdf/workspace-ui";
import { getEffectiveRotation } from "@/lib/tools/organize-pdf/rotation";
import { renderOrganizePageThumbnailUrl } from "@/lib/tools/organize-pdf/thumbnail-render";
import type { OrganizePageEntry } from "@/lib/tools/organize-pdf/types";

interface OrganizePageGridProps {
  pdfBytes: ArrayBuffer;
  pages: OrganizePageEntry[];
  disabled?: boolean;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onMoveFirst: (pageId: string) => void;
  onMoveEarlier: (pageId: string) => void;
  onMoveLater: (pageId: string) => void;
  onMoveLast: (pageId: string) => void;
  onRotate: (pageId: string) => void;
  onDelete: (pageId: string) => void;
}

interface ThumbnailState {
  url: string | null;
  loading: boolean;
  error?: boolean;
}

export function OrganizePageGrid({
  pdfBytes,
  pages,
  disabled = false,
  onReorder,
  onMoveFirst,
  onMoveEarlier,
  onMoveLater,
  onMoveLast,
  onRotate,
  onDelete,
}: OrganizePageGridProps) {
  const [thumbnails, setThumbnails] = useState<Record<string, ThumbnailState>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const thumbnailUrlsRef = useRef<Record<string, string>>({});

  const revokeThumbnailUrl = useCallback((pageId: string) => {
    const existing = thumbnailUrlsRef.current[pageId];
    if (existing) {
      URL.revokeObjectURL(existing);
      delete thumbnailUrlsRef.current[pageId];
    }
  }, []);

  const revokeAllThumbnailUrls = useCallback(() => {
    for (const pageId of Object.keys(thumbnailUrlsRef.current)) {
      revokeThumbnailUrl(pageId);
    }
  }, [revokeThumbnailUrl]);

  useEffect(() => {
    let cancelled = false;
    const activeIds = new Set(pages.map((page) => page.id));

    for (const pageId of Object.keys(thumbnailUrlsRef.current)) {
      if (!activeIds.has(pageId)) {
        revokeThumbnailUrl(pageId);
        setThumbnails((current) => {
          const next = { ...current };
          delete next[pageId];
          return next;
        });
      }
    }

    async function loadThumbnails() {
      for (const page of pages) {
        if (cancelled) return;

        setThumbnails((current) => ({
          ...current,
          [page.id]: {
            url: current[page.id]?.url ?? null,
            loading: true,
            error: false,
          },
        }));

        try {
          revokeThumbnailUrl(page.id);
          const url = await renderOrganizePageThumbnailUrl(pdfBytes, page, {
            devicePixelRatio:
              typeof window !== "undefined" ? window.devicePixelRatio : 1,
          });
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }

          thumbnailUrlsRef.current[page.id] = url;
          setThumbnails((current) => ({
            ...current,
            [page.id]: { url, loading: false },
          }));
        } catch {
          if (!cancelled) {
            setThumbnails((current) => ({
              ...current,
              [page.id]: { url: null, loading: false, error: true },
            }));
          }
        }
      }
    }

    void loadThumbnails();

    return () => {
      cancelled = true;
    };
  }, [
    pdfBytes,
    pages
      .map((page) => getPageThumbnailSignature(page))
      .sort()
      .join("|"),
    revokeThumbnailUrl,
  ]);

  useEffect(() => {
    return () => {
      revokeAllThumbnailUrls();
    };
  }, [revokeAllThumbnailUrls]);

  const handleDragStart = (index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    if (disabled || draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (draggedIndex !== null && draggedIndex !== index) {
      onReorder(draggedIndex, index);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Pages</h2>
        <p className="text-xs text-foreground-muted">
          Drag to reorder · or use move buttons on each page
        </p>
      </div>

      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        aria-live="polite"
      >
        {pages.map((page, index) => {
          const thumbnail = thumbnails[page.id];
          const isLoading = thumbnail?.loading ?? true;
          const previewUrl = thumbnail?.url;
          const previewError = thumbnail?.error;
          const displayNumber = getDisplayPageNumber(index);
          const effectiveRotation = getEffectiveRotation(
            page.intrinsicRotation,
            page.rotationDelta,
          );
          const allowDelete = canDeletePage(pages.length);

          return (
            <article
              key={page.id}
              draggable={!disabled}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(event) => handleDragOver(event, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`flex flex-col overflow-hidden rounded-2xl border bg-surface transition-all duration-200 ${
                dragOverIndex === index
                  ? "border-scanonix-orange ring-2 ring-scanonix-orange/30"
                  : "border-border"
              } ${draggedIndex === index ? "opacity-50" : ""} ${
                disabled ? "" : "cursor-grab active:cursor-grabbing"
              }`}
              aria-label={`Page ${displayNumber} of ${pages.length}`}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-white">
                <div className="absolute left-2 top-2 z-10 flex h-8 min-w-[2rem] items-center justify-center rounded-lg bg-black/80 px-2 text-sm font-bold text-white shadow-sm">
                  {displayNumber}
                </div>

                <div className="absolute right-2 top-2 z-10 flex h-8 min-w-[2rem] items-center justify-center rounded-lg bg-black/80 px-2 text-sm font-semibold text-white shadow-sm">
                  {effectiveRotation}°
                </div>

                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <svg
                      className="h-8 w-8 animate-spin text-scanonix-orange"
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

                {previewUrl && !isLoading && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt={`Page ${displayNumber} preview`}
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                )}

                {previewError && !isLoading && (
                  <div className="flex h-full items-center justify-center bg-black/5 px-2 text-center text-sm text-foreground-muted">
                    Preview unavailable
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2.5 border-t border-border p-3">
                <div className="grid grid-cols-4 gap-1.5">
                  <ActionButton
                    variant="outline"
                    size="sm"
                    className="rounded-lg px-1.5 text-xs"
                    disabled={disabled || !canMovePageFirst(index)}
                    onClick={() => onMoveFirst(page.id)}
                    aria-label={`Move page ${displayNumber} to first position`}
                  >
                    First
                  </ActionButton>
                  <ActionButton
                    variant="outline"
                    size="sm"
                    className="rounded-lg px-1.5 text-xs"
                    disabled={disabled || !canMovePageEarlier(index)}
                    onClick={() => onMoveEarlier(page.id)}
                    aria-label={`Move page ${displayNumber} earlier`}
                  >
                    Earlier
                  </ActionButton>
                  <ActionButton
                    variant="outline"
                    size="sm"
                    className="rounded-lg px-1.5 text-xs"
                    disabled={
                      disabled || !canMovePageLater(index, pages.length)
                    }
                    onClick={() => onMoveLater(page.id)}
                    aria-label={`Move page ${displayNumber} later`}
                  >
                    Later
                  </ActionButton>
                  <ActionButton
                    variant="outline"
                    size="sm"
                    className="rounded-lg px-1.5 text-xs"
                    disabled={
                      disabled || !canMovePageLast(index, pages.length)
                    }
                    onClick={() => onMoveLast(page.id)}
                    aria-label={`Move page ${displayNumber} to last position`}
                  >
                    Last
                  </ActionButton>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <ActionButton
                    variant="secondary"
                    size="sm"
                    className="rounded-lg text-sm"
                    disabled={disabled}
                    onClick={() => onRotate(page.id)}
                    aria-label={`Rotate page ${displayNumber} clockwise 90 degrees`}
                  >
                    Rotate 90°
                  </ActionButton>
                  <ActionButton
                    variant="danger"
                    size="sm"
                    className="rounded-lg text-sm"
                    disabled={disabled || !allowDelete}
                    onClick={() => onDelete(page.id)}
                    aria-label={
                      allowDelete
                        ? `Delete page ${displayNumber}`
                        : `Delete disabled — at least one page is required`
                    }
                  >
                    Delete
                  </ActionButton>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
