"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
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
      <div className="flex aspect-[3/4] w-[4.25rem] items-center justify-center rounded-md border border-border bg-white">
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
      <div className="flex aspect-[3/4] w-[4.25rem] items-center justify-center rounded-md border border-border bg-white px-1 text-center text-[10px] leading-tight text-scanonix-muted">
        Preview unavailable
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {previews.map((src, index) => (
        <div
          key={`${file.name}-${index}`}
          className="aspect-[3/4] w-[4.25rem] overflow-hidden rounded-md border border-border bg-white sm:w-[4.75rem]"
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
        <div className="flex aspect-[3/4] w-[3.25rem] items-center justify-center rounded-md border border-dashed border-border bg-surface-muted/60 text-center text-[10px] font-semibold text-scanonix-muted">
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
      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-muted text-foreground transition hover:bg-surface-raised hover:text-scanonix-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-40"
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
}: MergeDocumentGridProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (files.length === 0) {
    return null;
  }

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
    <div className="grid gap-2.5">
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
              className={`rounded-xl bg-surface-strong transition-all lg:w-[80%] lg:max-w-[42rem] ${
                dragOverIndex === index
                  ? "ring-2 ring-scanonix-orange"
                  : ""
              } ${draggedIndex === index ? "opacity-55" : ""} ${
                disabled ? "" : "cursor-grab active:cursor-grabbing"
              }`}
              aria-label={`Merge position ${index + 1}: ${pdfFile.file.name}`}
            >
              <div className="flex items-start gap-2.5 p-2.5 sm:gap-3 sm:p-3">
                <div className="flex w-7 shrink-0 flex-col items-center gap-1.5 pt-0.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-scanonix-orange/10 text-xs font-bold text-scanonix-orange">
                    {index + 1}
                  </div>
                  <GripVertical
                    className="h-4 w-4 text-scanonix-muted"
                    aria-hidden="true"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start gap-2">
                    <FileText
                      className="mt-0.5 h-4 w-4 shrink-0 text-scanonix-orange"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {pdfFile.file.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-scanonix-muted">
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

                  <div className="mt-2">
                    <DocumentPreview
                      file={pdfFile.file}
                      pageCount={pdfFile.pageCount}
                    />
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-center gap-1">
                  <OrderButton
                    label="Move up"
                    disabled={disabled || isFirst}
                    onClick={() => onReorder(index, index - 1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </OrderButton>
                  <OrderButton
                    label="Move down"
                    disabled={disabled || isLast}
                    onClick={() => onReorder(index, index + 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </OrderButton>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemove(pdfFile.id)}
                    aria-label={`Remove ${pdfFile.file.name}`}
                    title={`Remove ${pdfFile.file.name}`}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-foreground-muted transition hover:bg-red-500/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/25 disabled:cursor-not-allowed disabled:opacity-40"
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
  );
}
