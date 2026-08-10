"use client";

import { useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { formatFileSize } from "@/lib/tools/format-utils";
import type { PdfFileItem } from "@/lib/tools/types";

interface PdfFileListProps {
  files: PdfFileItem[];
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  disabled?: boolean;
}

export function PdfFileList({
  files,
  onRemove,
  onReorder,
  disabled = false,
}: PdfFileListProps) {
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">
          PDF files ({files.length})
        </h2>
        <div className="flex items-center gap-3 text-xs text-scanonix-muted">
          <span>{totalPages} total pages</span>
          <span>·</span>
          <span>Drag to reorder</span>
        </div>
      </div>

      <div className="space-y-3">
        {files.map((pdfFile, index) => (
          <article
            key={pdfFile.id}
            draggable={!disabled}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(event) => handleDragOver(event, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-4 rounded-2xl border bg-scanonix-surface p-4 transition-all duration-200 sm:p-5 ${
              dragOverIndex === index
                ? "border-scanonix-orange ring-2 ring-scanonix-orange/30"
                : "border-scanonix-border"
            } ${draggedIndex === index ? "opacity-50" : ""} ${
              disabled ? "" : "cursor-grab active:cursor-grabbing"
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-scanonix-orange/10 text-sm font-bold text-scanonix-orange">
              {index + 1}
            </div>

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-scanonix-border bg-black/40 text-scanonix-orange">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14 3v4a2 2 0 002 2h4"
                />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white sm:text-base">
                {pdfFile.file.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-scanonix-muted">
                <span>{formatFileSize(pdfFile.file.size)}</span>
                <span>·</span>
                {pdfFile.pageCountError ? (
                  <span className="text-red-400">{pdfFile.pageCountError}</span>
                ) : pdfFile.pageCount === null ? (
                  <span className="inline-flex items-center gap-1.5">
                    <svg
                      className="h-3 w-3 animate-spin"
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
                    Reading pages…
                  </span>
                ) : (
                  <span>
                    {pdfFile.pageCount} page{pdfFile.pageCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>

            <ActionButton
              variant="danger"
              size="sm"
              className="shrink-0 rounded-xl px-3"
              disabled={disabled}
              onClick={() => onRemove(pdfFile.id)}
              aria-label={`Remove ${pdfFile.file.name}`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </ActionButton>
          </article>
        ))}
      </div>
    </div>
  );
}
