"use client";

import {
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  moveNormalizedCrop,
  resizeNormalizedCrop,
  type CropResizeHandle,
} from "@/lib/tools/crop-pdf/workspace-ui";
import type { NormalizedCropRect } from "@/lib/tools/crop-pdf/types";

interface CropOverlayProps {
  crop: NormalizedCropRect;
  disabled?: boolean;
  onChange: (crop: NormalizedCropRect) => void;
}

const CORNER_HANDLES: Array<{
  handle: CropResizeHandle;
  className: string;
  label: string;
}> = [
  {
    handle: "nw",
    className: "-left-3 -top-3 cursor-nwse-resize",
    label: "Resize crop top-left",
  },
  {
    handle: "ne",
    className: "-right-3 -top-3 cursor-nesw-resize",
    label: "Resize crop top-right",
  },
  {
    handle: "sw",
    className: "-bottom-3 -left-3 cursor-nesw-resize",
    label: "Resize crop bottom-left",
  },
  {
    handle: "se",
    className: "-right-3 -bottom-3 cursor-nwse-resize",
    label: "Resize crop bottom-right",
  },
];

const EDGE_HANDLES: Array<{
  handle: CropResizeHandle;
  className: string;
  label: string;
}> = [
  {
    handle: "n",
    className: "-top-3 left-1/2 -translate-x-1/2 cursor-ns-resize",
    label: "Resize crop top edge",
  },
  {
    handle: "s",
    className: "-bottom-3 left-1/2 -translate-x-1/2 cursor-ns-resize",
    label: "Resize crop bottom edge",
  },
  {
    handle: "w",
    className: "-left-3 top-1/2 -translate-y-1/2 cursor-ew-resize",
    label: "Resize crop left edge",
  },
  {
    handle: "e",
    className: "-right-3 top-1/2 -translate-y-1/2 cursor-ew-resize",
    label: "Resize crop right edge",
  },
];

export function CropOverlay({
  crop,
  disabled = false,
  onChange,
}: CropOverlayProps) {
  const dragStateRef = useRef<{
    mode: "move" | "resize";
    handle?: CropResizeHandle;
    startX: number;
    startY: number;
    containerWidth: number;
    containerHeight: number;
    origin: NormalizedCropRect;
  } | null>(null);

  const getContainerSize = (element: HTMLElement) => {
    const container = element.closest("[data-crop-page-overlay-root]");
    const rect = container?.getBoundingClientRect();
    return {
      width: rect?.width ?? 1,
      height: rect?.height ?? 1,
    };
  };

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    mode: "move" | "resize",
    handle?: CropResizeHandle,
  ) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const { width, height } = getContainerSize(event.currentTarget);
    dragStateRef.current = {
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      containerWidth: width,
      containerHeight: height,
      origin: { ...crop },
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || disabled) return;
    event.preventDefault();

    const deltaX =
      (event.clientX - dragState.startX) / dragState.containerWidth;
    const deltaY =
      (event.clientY - dragState.startY) / dragState.containerHeight;

    if (dragState.mode === "move") {
      onChange(moveNormalizedCrop(dragState.origin, deltaX, deltaY));
      return;
    }

    if (dragState.handle) {
      onChange(
        resizeNormalizedCrop(
          dragState.origin,
          dragState.handle,
          deltaX,
          deltaY,
        ),
      );
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragStateRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
  };

  const left = crop.x * 100;
  const top = crop.y * 100;
  const width = crop.width * 100;
  const height = crop.height * 100;

  return (
    <div className="pointer-events-none absolute inset-0 touch-none select-none">
      {/* Dim outside crop area */}
      <div
        className="absolute left-0 right-0 top-0 bg-black/45"
        style={{ height: `${top}%` }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 bg-black/45"
        style={{ height: `${100 - top - height}%` }}
      />
      <div
        className="absolute bg-black/45"
        style={{
          left: 0,
          top: `${top}%`,
          width: `${left}%`,
          height: `${height}%`,
        }}
      />
      <div
        className="absolute bg-black/45"
        style={{
          left: `${left + width}%`,
          top: `${top}%`,
          width: `${100 - left - width}%`,
          height: `${height}%`,
        }}
      />

      <div
        className="pointer-events-auto absolute touch-none"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
        }}
      >
        <button
          type="button"
          aria-label="Move crop area"
          disabled={disabled}
          onPointerDown={(event) => handlePointerDown(event, "move")}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 cursor-move rounded-sm border-2 border-scanonix-orange bg-transparent ring-2 ring-scanonix-orange/20"
        />

        {CORNER_HANDLES.map(({ handle, className, label }) => (
          <button
            key={handle}
            type="button"
            aria-label={label}
            disabled={disabled}
            onPointerDown={(event) => handlePointerDown(event, "resize", handle)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`absolute flex h-11 w-11 items-center justify-center rounded-full border-2 border-scanonix-orange bg-scanonix-surface shadow-lg ${className}`}
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full bg-scanonix-orange"
            />
          </button>
        ))}

        {EDGE_HANDLES.map(({ handle, className, label }) => (
          <button
            key={handle}
            type="button"
            aria-label={label}
            disabled={disabled}
            onPointerDown={(event) => handlePointerDown(event, "resize", handle)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`absolute flex h-9 w-9 items-center justify-center rounded-full border border-scanonix-orange/80 bg-scanonix-surface/95 shadow ${className}`}
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-scanonix-orange"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
