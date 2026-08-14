"use client";

import {
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { clampNormalizedPlacement } from "@/lib/tools/sign-pdf/coordinates";
import type { NormalizedPlacement } from "@/lib/tools/sign-pdf/types";

interface SignaturePlacementOverlayProps {
  placement: NormalizedPlacement;
  previewUrl: string;
  aspectRatio: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onChange: (placement: NormalizedPlacement) => void;
  onDelete: () => void;
}

export function SignaturePlacementOverlay({
  placement,
  previewUrl,
  aspectRatio,
  selected,
  disabled = false,
  onSelect,
  onChange,
  onDelete,
}: SignaturePlacementOverlayProps) {
  const dragStateRef = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    containerWidth: number;
    containerHeight: number;
    origin: NormalizedPlacement;
  } | null>(null);

  const getContainerSize = (element: HTMLElement) => {
    const container = element.closest("[data-sign-page-overlay-root]");
    const rect = container?.getBoundingClientRect();
    return {
      width: rect?.width ?? 1,
      height: rect?.height ?? 1,
    };
  };

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    mode: "move" | "resize",
  ) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    event.currentTarget.setPointerCapture(event.pointerId);
    const { width, height } = getContainerSize(event.currentTarget);
    dragStateRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      containerWidth: width,
      containerHeight: height,
      origin: { ...placement },
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || disabled) return;
    event.preventDefault();

    const deltaX = (event.clientX - dragState.startX) / dragState.containerWidth;
    const deltaY = (event.clientY - dragState.startY) / dragState.containerHeight;
    const safeAspect = aspectRatio > 0 ? aspectRatio : 2.5;

    if (dragState.mode === "move") {
      const next = clampNormalizedPlacement({
        normX: dragState.origin.normX + deltaX,
        normY: dragState.origin.normY + deltaY,
        normWidth: dragState.origin.normWidth,
        normHeight: dragState.origin.normHeight,
      });
      onChange({ ...placement, ...next });
      return;
    }

    let normWidth = Math.max(0.05, dragState.origin.normWidth + deltaX);
    let normHeight = normWidth / safeAspect;

    if (dragState.origin.normY + normHeight > 1) {
      normHeight = 1 - dragState.origin.normY;
      normWidth = normHeight * safeAspect;
    }
    if (dragState.origin.normX + normWidth > 1) {
      normWidth = 1 - dragState.origin.normX;
      normHeight = normWidth / safeAspect;
    }

    const next = clampNormalizedPlacement({
      normX: dragState.origin.normX,
      normY: dragState.origin.normY,
      normWidth,
      normHeight,
    });
    onChange({ ...placement, ...next });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragStateRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
  };

  return (
    <div
      className={`absolute touch-none ${selected ? "z-20" : "z-10"}`}
      style={{
        left: `${placement.normX * 100}%`,
        top: `${placement.normY * 100}%`,
        width: `${placement.normWidth * 100}%`,
        height: `${placement.normHeight * 100}%`,
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt=""
        draggable={false}
        className="pointer-events-none h-full w-full select-none object-contain"
      />
      <button
        type="button"
        aria-label="Move signature"
        disabled={disabled}
        onPointerDown={(event) => handlePointerDown(event, "move")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`absolute inset-0 rounded border-2 bg-transparent ${
          selected
            ? "border-scanonix-orange ring-2 ring-scanonix-orange/30"
            : "border-transparent hover:border-scanonix-orange/50"
        }`}
      />
      {selected && (
        <>
          <button
            type="button"
            aria-label="Resize signature"
            disabled={disabled}
            onPointerDown={(event) => handlePointerDown(event, "resize")}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="absolute -bottom-3 -right-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-scanonix-orange bg-scanonix-surface text-scanonix-orange shadow-lg"
          >
            <span aria-hidden="true" className="text-xs font-bold">
              ↘
            </span>
          </button>
          <button
            type="button"
            aria-label="Delete signature placement"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full border border-red-400/50 bg-red-500/20 text-red-200"
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}
