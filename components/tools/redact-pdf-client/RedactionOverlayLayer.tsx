"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  normalizedRedactionFromPointerDrag,
  pointerToNormalizedPoint,
} from "@/lib/tools/redact-pdf/workspace-ui";
import type { NormalizedRedactionRect } from "@/lib/tools/redact-pdf/types";
import { RedactionMark } from "./RedactionMark";

interface RedactionOverlayLayerProps {
  redactions: Array<NormalizedRedactionRect & { id: string }>;
  selectedRedactionId: string | null;
  drawModeActive: boolean;
  disabled?: boolean;
  onSelectRedaction: (id: string | null) => void;
  onRedactionChange: (id: string, rect: NormalizedRedactionRect) => void;
  onDrawComplete: (rect: NormalizedRedactionRect) => void;
}

export function RedactionOverlayLayer({
  redactions,
  selectedRedactionId,
  drawModeActive,
  disabled = false,
  onSelectRedaction,
  onRedactionChange,
  onDrawComplete,
}: RedactionOverlayLayerProps) {
  const drawStateRef = useRef<{
    startX: number;
    startY: number;
    containerWidth: number;
    containerHeight: number;
  } | null>(null);
  const [draftRect, setDraftRect] = useState<NormalizedRedactionRect | null>(null);

  const getContainerRect = (element: HTMLElement) => {
    const container = element.closest("[data-redact-page-overlay-root]");
    return container?.getBoundingClientRect();
  };

  const handleDrawPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawModeActive || disabled) return;
    if ((event.target as HTMLElement).closest("[data-redaction-mark]")) {
      return;
    }

    event.preventDefault();
    const rect = getContainerRect(event.currentTarget);
    if (!rect) return;

    onSelectRedaction(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    drawStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      containerWidth: rect.width,
      containerHeight: rect.height,
    };
    setDraftRect(null);
  };

  const handleDrawPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drawState = drawStateRef.current;
    if (!drawState || !drawModeActive || disabled) return;
    event.preventDefault();

    const containerRect = getContainerRect(event.currentTarget);
    if (!containerRect) return;

    const start = pointerToNormalizedPoint(
      drawState.startX,
      drawState.startY,
      containerRect,
    );
    const end = pointerToNormalizedPoint(
      event.clientX,
      event.clientY,
      containerRect,
    );
    const nextDraft = normalizedRedactionFromPointerDrag(start, end);
    setDraftRect(nextDraft);
  };

  const handleDrawPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drawState = drawStateRef.current;
    if (!drawState) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const containerRect = getContainerRect(event.currentTarget);
    if (containerRect) {
      const start = pointerToNormalizedPoint(
        drawState.startX,
        drawState.startY,
        containerRect,
      );
      const end = pointerToNormalizedPoint(
        event.clientX,
        event.clientY,
        containerRect,
      );
      const created = normalizedRedactionFromPointerDrag(start, end);
      if (created) {
        onDrawComplete(created);
      }
    }

    drawStateRef.current = null;
    setDraftRect(null);
  };

  const draftStyle = draftRect
    ? {
        left: `${draftRect.x * 100}%`,
        top: `${draftRect.y * 100}%`,
        width: `${draftRect.width * 100}%`,
        height: `${draftRect.height * 100}%`,
      }
    : null;

  return (
    <div
      data-redact-overlay-layer
      className={`absolute inset-0 touch-none select-none ${
        drawModeActive ? "cursor-crosshair" : ""
      }`}
      onPointerDown={handleDrawPointerDown}
      onPointerMove={handleDrawPointerMove}
      onPointerUp={handleDrawPointerUp}
      onPointerCancel={handleDrawPointerUp}
      onClick={() => {
        if (!drawModeActive) {
          onSelectRedaction(null);
        }
      }}
    >
      {redactions.map((rect) => (
        <RedactionMark
          key={rect.id}
          rect={rect}
          selected={rect.id === selectedRedactionId}
          disabled={disabled}
          onSelect={() => onSelectRedaction(rect.id)}
          onChange={(nextRect) => onRedactionChange(rect.id, nextRect)}
        />
      ))}

      {draftStyle && (
        <div
          data-redaction-draft
          aria-hidden="true"
          className="pointer-events-none absolute border-2 border-dashed border-scanonix-orange bg-black/50"
          style={draftStyle}
        />
      )}
    </div>
  );
}
