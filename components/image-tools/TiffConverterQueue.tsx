"use client";

import { useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { formatFileSize } from "@/lib/tools/format-utils";
import type { JpgImageItem } from "@/types/tool";

export type TiffPreviewStatus = "loading" | "ready" | "meta" | "unavailable";

export interface TiffPreviewView {
  status: TiffPreviewStatus;
  url: string | null;
  extraPages?: boolean;
}

interface TiffConverterQueueProps {
  images: JpgImageItem[];
  previews: Record<string, TiffPreviewView>;
  resultPreviewUrl?: string | null;
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onPreviewError: (id: string) => void;
  disabled?: boolean;
}

function dimensionLabel(width: number | null, height: number | null): string | null {
  if (!width || !height) return null;
  return `${width} × ${height}`;
}

function FileThumb({
  image,
  preview,
  resultPreviewUrl,
  onPreviewError,
  compact = false,
}: {
  image: JpgImageItem;
  preview: TiffPreviewView | undefined;
  resultPreviewUrl?: string | null;
  onPreviewError: (id: string) => void;
  compact?: boolean;
}) {
  const sourceUrl = preview?.status === "ready" ? preview.url : null;
  const url = !compact && resultPreviewUrl ? resultPreviewUrl : sourceUrl;
  const status = url ? "ready" : (preview?.status ?? "loading");
  const frameClass = compact
    ? "tiff-row-thumb h-12 w-12 max-h-12 max-w-12 shrink-0 overflow-hidden"
    : "tiff-thumb h-[90px] w-[140px] max-h-[90px] max-w-[140px] min-w-0 shrink-0 overflow-hidden";

  if (url) {
    return (
      <div
        className={`${frameClass} tiff-checker`}
        data-tiff-preview={resultPreviewUrl && !compact ? "result" : "ready"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          draggable={false}
          className="block h-full max-h-full w-full max-w-full object-contain"
          onError={() => {
            if (!compact && resultPreviewUrl) return;
            onPreviewError(image.id);
          }}
        />
      </div>
    );
  }

  return (
    <div className={`${frameClass} is-fallback`} data-tiff-preview={status} aria-busy={status === "loading"}>
      <span>TIFF</span>
    </div>
  );
}

function RemoveButton({
  name,
  disabled,
  onClick,
}: {
  name: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <ActionButton
      variant="danger"
      size="sm"
      className="shrink-0"
      disabled={disabled}
      onClick={onClick}
      aria-label={`Remove ${name}`}
    >
      Remove
    </ActionButton>
  );
}

export function TiffConverterQueue({
  images,
  previews,
  resultPreviewUrl = null,
  onRemove,
  onReorder,
  onPreviewError,
  disabled = false,
}: TiffConverterQueueProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const canReorder = images.length > 1 && !disabled;

  const handleDrop = (index: number) => {
    if (draggedIndex !== null && draggedIndex !== index) onReorder(draggedIndex, index);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (images.length === 1) {
    const image = images[0];
    const preview = previews[image.id];
    const dimensions = dimensionLabel(image.width, image.height);
    const pageNote =
      preview?.status === "loading"
        ? "Preparing preview"
        : preview?.status === "unavailable"
          ? "Preview unavailable"
          : preview?.extraPages
            ? "First page of a multipage TIFF"
            : "First page";

    return (
      <article
        className="tiff-file grid min-w-0 grid-cols-[140px_minmax(0,1fr)_auto] items-center gap-x-4"
        data-tiff-file={image.file.name}
      >
        <FileThumb
          image={image}
          preview={preview}
          resultPreviewUrl={resultPreviewUrl}
          onPreviewError={onPreviewError}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground" title={image.file.name}>
            {image.file.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-scanonix-muted">
            {dimensions ? `${dimensions} · ` : ""}
            {formatFileSize(image.file.size)}
          </p>
          <p className="mt-0.5 text-xs text-scanonix-muted">{pageNote}</p>
        </div>
        <RemoveButton
          name={image.file.name}
          disabled={disabled}
          onClick={() => onRemove(image.id)}
        />
      </article>
    );
  }

  return (
    <ul className="tiff-file-list min-w-0 space-y-1">
      {images.map((image, index) => {
        const dimensions = dimensionLabel(image.width, image.height);
        const dragging = draggedIndex === index;
        const over = dragOverIndex === index;
        return (
          <li key={image.id}>
            <article
              data-tiff-file={image.file.name}
              draggable={canReorder}
              onDragStart={() => {
                if (canReorder) setDraggedIndex(index);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (!canReorder || draggedIndex === null || draggedIndex === index) return;
                setDragOverIndex(index);
              }}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              className={`tiff-file-row grid min-w-0 grid-cols-[auto_48px_minmax(0,1fr)_auto] items-center gap-x-3 ${over ? "is-over" : ""} ${dragging ? "is-dragging" : ""} ${
                canReorder ? "cursor-grab active:cursor-grabbing" : ""
              }`}
            >
              <span className="tiff-index" aria-hidden="true">
                {index + 1}
              </span>
              <FileThumb
                image={image}
                preview={previews[image.id]}
                onPreviewError={onPreviewError}
                compact
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground" title={image.file.name}>
                  {image.file.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-scanonix-muted">
                  {dimensions ? `${dimensions} · ` : ""}
                  {formatFileSize(image.file.size)}
                </p>
              </div>
              <RemoveButton
                name={image.file.name}
                disabled={disabled}
                onClick={() => onRemove(image.id)}
              />
            </article>
          </li>
        );
      })}
    </ul>
  );
}
