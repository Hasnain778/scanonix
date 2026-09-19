"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  CropRatioId,
  CropRect,
  EditorDocument,
  EditorViewport,
} from "@/lib/image-editor/document";
import {
  clampCropRect,
  cropRectToRotatedBounds,
  documentToStagePoint,
  moveCropRect,
  resizeCropRect,
  rotatedDocumentToSource,
  rotatedFullSize,
  stageToDocumentPoint,
  type Size,
} from "@/lib/image-editor/geometry";

type HandleId = "nw" | "ne" | "sw" | "se" | "move";

interface CropOverlayProps {
  sourceSize: Size;
  document: EditorDocument;
  viewport: EditorViewport;
  ratioId: CropRatioId;
  enabled: boolean;
  onCropLive: (crop: CropRect) => void;
  onCropCommit: (crop: CropRect) => void;
}

function getWorkingCrop(doc: EditorDocument, source: Size): CropRect {
  return (
    doc.crop ?? {
      x: 0,
      y: 0,
      width: source.width,
      height: source.height,
    }
  );
}

export function CropOverlay({
  sourceSize,
  document: doc,
  viewport,
  ratioId,
  enabled,
  onCropLive,
  onCropCommit,
}: CropOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [stageCss, setStageCss] = useState<Size>({ width: 1, height: 1 });
  const dragRef = useRef<{
    handle: HandleId;
    startCrop: CropRect;
    startSourcePoint: { x: number; y: number };
  } | null>(null);
  const latestCropRef = useRef<CropRect | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const rect = root.getBoundingClientRect();
      setStageCss({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const rotatedSize = rotatedFullSize(sourceSize, doc.rotation);
  const crop = getWorkingCrop(doc, sourceSize);
  const rotatedCrop = cropRectToRotatedBounds(crop, sourceSize, doc.rotation);

  const topLeft = documentToStagePoint(
    { x: rotatedCrop.x, y: rotatedCrop.y },
    rotatedSize,
    stageCss,
    viewport,
  );
  const bottomRight = documentToStagePoint(
    {
      x: rotatedCrop.x + rotatedCrop.width,
      y: rotatedCrop.y + rotatedCrop.height,
    },
    rotatedSize,
    stageCss,
    viewport,
  );

  const left = Math.min(topLeft.x, bottomRight.x);
  const top = Math.min(topLeft.y, bottomRight.y);
  const width = Math.abs(bottomRight.x - topLeft.x);
  const height = Math.abs(bottomRight.y - topLeft.y);

  const clientToSource = useCallback(
    (clientX: number, clientY: number) => {
      const root = rootRef.current;
      if (!root) return { x: 0, y: 0 };
      const rect = root.getBoundingClientRect();
      const stagePoint = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
      const docPoint = stageToDocumentPoint(
        stagePoint,
        rotatedSize,
        stageCss,
        viewport,
      );
      return rotatedDocumentToSource(docPoint, sourceSize, doc.rotation);
    },
    [doc.rotation, rotatedSize, sourceSize, stageCss, viewport],
  );

  useEffect(() => {
    if (!enabled) return;

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const current = clientToSource(event.clientX, event.clientY);
      const dx = current.x - drag.startSourcePoint.x;
      const dy = current.y - drag.startSourcePoint.y;
      let next: CropRect;

      if (drag.handle === "move") {
        next = moveCropRect(drag.startCrop, sourceSize, dx, dy);
      } else {
        const start = drag.startCrop;
        let proposed: Partial<CropRect> = {};
        if (drag.handle === "se") {
          proposed = {
            width: start.width + dx,
            height: start.height + dy,
          };
        } else if (drag.handle === "sw") {
          proposed = {
            x: start.x + dx,
            width: start.width - dx,
            height: start.height + dy,
          };
        } else if (drag.handle === "ne") {
          proposed = {
            y: start.y + dy,
            width: start.width + dx,
            height: start.height - dy,
          };
        } else {
          proposed = {
            x: start.x + dx,
            y: start.y + dy,
            width: start.width - dx,
            height: start.height - dy,
          };
        }
        next = resizeCropRect(start, sourceSize, proposed, ratioId);
        if (drag.handle === "nw") {
          next = clampCropRect(
            {
              ...next,
              x: start.x + start.width - next.width,
              y: start.y + start.height - next.height,
            },
            sourceSize,
          );
        } else if (drag.handle === "ne") {
          next = clampCropRect(
            {
              ...next,
              y: start.y + start.height - next.height,
            },
            sourceSize,
          );
        } else if (drag.handle === "sw") {
          next = clampCropRect(
            {
              ...next,
              x: start.x + start.width - next.width,
            },
            sourceSize,
          );
        }
      }

      latestCropRef.current = next;
      onCropLive(next);
    };

    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      if (latestCropRef.current) {
        onCropCommit(latestCropRef.current);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [clientToSource, enabled, onCropCommit, onCropLive, ratioId, sourceSize]);

  const beginDrag = (
    handle: HandleId,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const startCrop = getWorkingCrop(doc, sourceSize);
    latestCropRef.current = startCrop;
    dragRef.current = {
      handle,
      startCrop,
      startSourcePoint: clientToSource(event.clientX, event.clientY),
    };
  };

  if (!enabled) {
    return null;
  }

  const handleClass =
    "absolute z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-white bg-scanonix-orange shadow touch-none";

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-10"
      data-crop-overlay=""
    >
      <div
        className="pointer-events-none absolute bg-black/45"
        style={{ left: 0, top: 0, width: "100%", height: Math.max(0, top) }}
      />
      <div
        className="pointer-events-none absolute bg-black/45"
        style={{
          left: 0,
          top: top + height,
          width: "100%",
          height: Math.max(0, stageCss.height - top - height),
        }}
      />
      <div
        className="pointer-events-none absolute bg-black/45"
        style={{ left: 0, top, width: Math.max(0, left), height }}
      />
      <div
        className="pointer-events-none absolute bg-black/45"
        style={{
          left: left + width,
          top,
          width: Math.max(0, stageCss.width - left - width),
          height,
        }}
      />
      <div
        className="pointer-events-auto absolute border-2 border-scanonix-orange shadow-[0_0_0_1px_rgba(0,0,0,0.35)] touch-none"
        style={{ left, top, width, height }}
        onPointerDown={(e) => beginDrag("move", e)}
      >
        <span
          className={`${handleClass} cursor-nwse-resize`}
          style={{ left: 0, top: 0 }}
          onPointerDown={(e) => beginDrag("nw", e)}
        />
        <span
          className={`${handleClass} cursor-nesw-resize`}
          style={{ left: "100%", top: 0 }}
          onPointerDown={(e) => beginDrag("ne", e)}
        />
        <span
          className={`${handleClass} cursor-nesw-resize`}
          style={{ left: 0, top: "100%" }}
          onPointerDown={(e) => beginDrag("sw", e)}
        />
        <span
          className={`${handleClass} cursor-nwse-resize`}
          style={{ left: "100%", top: "100%" }}
          onPointerDown={(e) => beginDrag("se", e)}
        />
      </div>
    </div>
  );
}
