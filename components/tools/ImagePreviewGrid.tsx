"use client";

import { useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { formatFileSize } from "@/lib/tools/format-utils";
import type { Rotation } from "@/lib/tools/types";

export interface PreviewImageItem {
  id: string;
  file: File;
  previewUrl: string;
  rotation?: Rotation;
  width?: number | null;
  height?: number | null;
}

interface ImagePreviewGridProps {
  images: PreviewImageItem[];
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRotate?: (id: string) => void;
  showDimensions?: boolean;
  disabled?: boolean;
}

export function ImagePreviewGrid({
  images,
  onRemove,
  onReorder,
  onRotate,
  showDimensions = false,
  disabled = false,
}: ImagePreviewGridProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (images.length === 0) {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          Images ({images.length})
        </h2>
        <p className="text-xs text-scanonix-muted">Drag to reorder</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((image, index) => (
          <article
            key={image.id}
            draggable={!disabled}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(event) => handleDragOver(event, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={`group relative overflow-hidden rounded-2xl border bg-scanonix-surface transition-all duration-200 ${
              dragOverIndex === index
                ? "border-scanonix-orange ring-2 ring-scanonix-orange/30"
                : "border-scanonix-border"
            } ${draggedIndex === index ? "opacity-50" : ""} ${
              disabled ? "" : "cursor-grab active:cursor-grabbing"
            }`}
          >
            <div className="absolute left-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white">
              {index + 1}
            </div>

            <div className="aspect-[4/3] overflow-hidden bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.previewUrl}
                alt={image.file.name}
                className="h-full w-full object-contain transition-transform duration-300"
                style={
                  image.rotation
                    ? { transform: `rotate(${image.rotation}deg)` }
                    : undefined
                }
                draggable={false}
              />
            </div>

            <div className="border-t border-scanonix-border p-3">
              <p className="truncate text-sm font-medium text-white">
                {image.file.name}
              </p>
              <p className="mt-0.5 text-xs text-scanonix-muted">
                {formatFileSize(image.file.size)}
                {showDimensions &&
                  image.width &&
                  image.height &&
                  ` · ${image.width} × ${image.height}px`}
                {!showDimensions &&
                  image.rotation !== undefined &&
                  image.rotation !== 0 &&
                  ` · ${image.rotation}° rotated`}
              </p>

              <div className="mt-3 flex gap-2">
                {onRotate && (
                  <ActionButton
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-xl"
                    disabled={disabled}
                    onClick={() => onRotate(image.id)}
                    aria-label={`Rotate ${image.file.name}`}
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
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Rotate
                  </ActionButton>
                )}
                <ActionButton
                  variant="danger"
                  size="sm"
                  className={`rounded-xl px-3 ${onRotate ? "" : "ml-auto w-full"}`}
                  disabled={disabled}
                  onClick={() => onRemove(image.id)}
                  aria-label={`Remove ${image.file.name}`}
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
                  {onRotate ? null : "Remove"}
                </ActionButton>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function nextRotation(current: Rotation): Rotation {
  const rotations: Rotation[] = [0, 90, 180, 270];
  const index = rotations.indexOf(current);
  return rotations[(index + 1) % rotations.length];
}

export { nextRotation };
