"use client";

import {
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  moveNormalizedRedaction,
  resizeNormalizedRedaction,
  type RedactionResizeHandle,
} from "@/lib/tools/redact-pdf/workspace-ui";
import type { NormalizedRedactionRect } from "@/lib/tools/redact-pdf/types";

interface RedactionMarkProps {
  rect: NormalizedRedactionRect;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onChange: (rect: NormalizedRedactionRect) => void;
}

const CORNER_HANDLES: Array<{
  handle: RedactionResizeHandle;
  className: string;
  label: string;
}> = [
  {
    handle: "nw",
    className: "-left-3 -top-3 cursor-nwse-resize",
    label: "Resize redaction top-left",
  },
  {
    handle: "ne",
    className: "-right-3 -top-3 cursor-nesw-resize",
    label: "Resize redaction top-right",
  },
  {
    handle: "sw",
    className: "-bottom-3 -left-3 cursor-nesw-resize",
    label: "Resize redaction bottom-left",
  },
  {
    handle: "se",
    className: "-right-3 -bottom-3 cursor-nwse-resize",
    label: "Resize redaction bottom-right",
  },
];

const EDGE_HANDLES: Array<{
  handle: RedactionResizeHandle;
  className: string;
  label: string;
}> = [
  {
    handle: "n",
    className: "-top-3 left-1/2 -translate-x-1/2 cursor-ns-resize",
    label: "Resize redaction top edge",
  },
  {
    handle: "s",
    className: "-bottom-3 left-1/2 -translate-x-1/2 cursor-ns-resize",
    label: "Resize redaction bottom edge",
  },
  {
    handle: "w",
    className: "-left-3 top-1/2 -translate-y-1/2 cursor-ew-resize",
    label: "Resize redaction left edge",
  },
  {
    handle: "e",
    className: "-right-3 top-1/2 -translate-y-1/2 cursor-ew-resize",
    label: "Resize redaction right edge",
  },
];

export function RedactionMark({
  rect,
  selected,
  disabled = false,
  onSelect,
  onChange,
}: RedactionMarkProps) {
  const dragStateRef = useRef<{
    mode: "move" | "resize";
    handle?: RedactionResizeHandle;
    startX: number;
    startY: number;
    containerWidth: number;
    containerHeight: number;
    origin: NormalizedRedactionRect;
  } | null>(null);

  const getContainerSize = (element: HTMLElement) => {
    const container = element.closest("[data-redact-page-overlay-root]");
    const bounds = container?.getBoundingClientRect();
    return {
      width: bounds?.width ?? 1,
      height: bounds?.height ?? 1,
    };
  };

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    mode: "move" | "resize",
    handle?: RedactionResizeHandle,
  ) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    event.currentTarget.setPointerCapture(event.pointerId);
    const { width, height } = getContainerSize(event.currentTarget);
    dragStateRef.current = {
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      containerWidth: width,
      containerHeight: height,
      origin: { ...rect },
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
      onChange(moveNormalizedRedaction(dragState.origin, deltaX, deltaY));
      return;
    }

    if (dragState.handle) {
      onChange(
        resizeNormalizedRedaction(
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

  const left = rect.x * 100;
  const top = rect.y * 100;
  const width = rect.width * 100;
  const height = rect.height * 100;

  return (
    <div
      data-redaction-mark
      data-redaction-selected={selected ? "true" : "false"}
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
        aria-label={selected ? "Selected redaction area" : "Redaction area"}
        aria-pressed={selected}
        disabled={disabled}
        onPointerDown={(event) => handlePointerDown(event, "move")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        className={`absolute inset-0 cursor-move bg-black/70 ${
          selected
            ? "border-2 border-scanonix-orange ring-2 ring-scanonix-orange/30"
            : "border border-black/80"
        }`}
      />

      {selected &&
        CORNER_HANDLES.map(({ handle, className, label }) => (
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

      {selected &&
        EDGE_HANDLES.map(({ handle, className, label }) => (
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
  );
}
