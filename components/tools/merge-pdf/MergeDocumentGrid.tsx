"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  FileText,
  GripVertical,
  Trash2,
} from "lucide-react";
import { formatFileSize } from "@/lib/tools/format-utils";
import { renderPagePreviewDataUrl } from "@/lib/tools/pdf-to-image/pdf-render";
import type { PdfFileItem } from "@/lib/tools/types";

interface MergeDocumentGridProps {
  files: PdfFileItem[];
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  disabled?: boolean;
  /** Compact control shown beside the Merge order heading (e.g. Add PDFs). */
  headerAction?: ReactNode;
}

const MAX_THUMBS_PER_DOC = 3;

function DocumentPreview({
  file,
  pageCount,
}: {
  file: File;
  pageCount: number | null;
}) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const thumbCount =
    pageCount && pageCount > 0
      ? Math.min(pageCount, MAX_THUMBS_PER_DOC)
      : 1;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFailed(false);
      setPreviews([]);

      try {
        const bytes = await file.arrayBuffer();
        const urls: string[] = [];

        for (let page = 1; page <= thumbCount; page++) {
          if (cancelled) return;
          try {
            const url = await renderPagePreviewDataUrl(bytes, page);
            urls.push(url);
          } catch {
            // Continue; partial thumbs still useful
          }
        }

        if (!cancelled) {
          setPreviews(urls);
          setFailed(urls.length === 0);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [file, thumbCount]);

  if (loading) {
    return (
      <div className="flex aspect-[3/4] w-full max-w-[7.5rem] items-center justify-center rounded-lg border border-border bg-white">
        <svg
          className="h-5 w-5 animate-spin text-scanonix-orange"
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
    );
  }

  if (failed || previews.length === 0) {
    return (
      <div className="flex aspect-[3/4] w-full max-w-[7.5rem] items-center justify-center rounded-lg border border-border bg-white px-2 text-center text-[11px] text-scanonix-muted">
        Preview unavailable
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {previews.map((src, index) => (
        <div
          key={`${file.name}-${index}`}
          className="aspect-[3/4] w-[5.5rem] overflow-hidden rounded-lg border border-border bg-white shadow-sm sm:w-[6.5rem]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`Page ${index + 1} of ${file.name}`}
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>
      ))}
      {pageCount != null && pageCount > previews.length && (
        <div className="flex aspect-[3/4] w-[4.5rem] items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted/60 text-center text-[10px] font-semibold text-scanonix-muted sm:w-[5rem]">
          +{pageCount - previews.length} more
        </div>
      )}
    </div>
  );
}

function OrderButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-muted text-foreground transition hover:border-scanonix-orange/40 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function MergeDocumentGrid({
  files,
  onRemove,
  onReorder,
  disabled = false,
  headerAction,
}: MergeDocumentGridProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (files.length === 0) {
    return null;
  }

  const totalPages = files.reduce(
    (sum, file) => sum + (file.pageCount ?? 0),
    0,
  );

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Merge order
          </h2>
          <p className="mt-0.5 text-xs text-scanonix-muted sm:text-sm">
            Arrange your PDFs in the order they should appear in the final
            document. Drag cards or use the arrows.
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
          {headerAction}
          <p className="text-xs font-medium text-scanonix-muted sm:text-right">
            {files.length} PDF{files.length === 1 ? "" : "s"}
            {totalPages > 0 ? ` · ${totalPages} pages` : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {files.map((pdfFile, index) => {
          const isFirst = index === 0;
          const isLast = index === files.length - 1;

          return (
            <article
              key={pdfFile.id}
              draggable={!disabled}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(event) => handleDragOver(event, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`overflow-hidden rounded-xl border bg-surface shadow-sm transition-all ${
                dragOverIndex === index
                  ? "border-scanonix-orange shadow-[0_0_0_1px_color-mix(in_srgb,var(--scanonix-orange)_35%,transparent)]"
                  : "border-border"
              } ${draggedIndex === index ? "opacity-55" : ""} ${
                disabled ? "" : "cursor-grab active:cursor-grabbing"
              }`}
              aria-label={`Merge position ${index + 1}: ${pdfFile.file.name}`}
            >
              <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-stretch sm:gap-4 sm:p-4">
                <div className="flex items-start gap-3 sm:w-12 sm:flex-col sm:items-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-scanonix-orange/35 bg-scanonix-orange/10 text-sm font-bold text-scanonix-orange">
                    {index + 1}
                  </div>
                  <GripVertical
                    className="mt-1 h-4 w-4 text-scanonix-muted sm:mt-0"
                    aria-hidden="true"
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted text-scanonix-orange">
                      <FileText className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {pdfFile.file.name}
                      </p>
                      <p className="mt-0.5 text-xs text-scanonix-muted">
                        {formatFileSize(pdfFile.file.size)}
                        {pdfFile.pageCountError
                          ? ` · ${pdfFile.pageCountError}`
                          : pdfFile.pageCount === null
                            ? " · Reading pages…"
                            : ` · ${pdfFile.pageCount} page${
                                pdfFile.pageCount === 1 ? "" : "s"
                              }`}
                      </p>
                    </div>
                  </div>

                  <DocumentPreview
                    file={pdfFile.file}
                    pageCount={pdfFile.pageCount}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:w-[7.5rem] sm:flex-col sm:items-stretch">
                  <div className="flex gap-1.5 sm:grid sm:grid-cols-2">
                    <OrderButton
                      label="Move to first"
                      disabled={disabled || isFirst}
                      onClick={() => onReorder(index, 0)}
                    >
                      <ChevronsUp className="h-4 w-4" aria-hidden="true" />
                    </OrderButton>
                    <OrderButton
                      label="Move earlier"
                      disabled={disabled || isFirst}
                      onClick={() => onReorder(index, index - 1)}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </OrderButton>
                    <OrderButton
                      label="Move later"
                      disabled={disabled || isLast}
                      onClick={() => onReorder(index, index + 1)}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </OrderButton>
                    <OrderButton
                      label="Move to last"
                      disabled={disabled || isLast}
                      onClick={() => onReorder(index, files.length - 1)}
                    >
                      <ChevronsDown className="h-4 w-4" aria-hidden="true" />
                    </OrderButton>
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemove(pdfFile.id)}
                    aria-label={`Remove ${pdfFile.file.name}`}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-red-500/25 bg-red-500/[0.06] px-2.5 text-xs font-semibold text-foreground transition hover:border-red-500/40 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/25 disabled:cursor-not-allowed disabled:opacity-40 sm:w-full"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
