"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { EditorDocument, EditorViewport } from "@/lib/image-editor/document";
import type { CanvasFrameLayout } from "@/lib/image-editor/geometry";
import { stagePointToCanvasPoint } from "@/lib/image-editor/geometry";
import { paintStage, type RenderSource } from "@/lib/image-editor/render";
import {
  createCanvasMeasureWidth,
  hitTestTextsTopFirst,
} from "@/lib/image-editor/text";

interface EditorStageProps {
  source: RenderSource | null;
  document: EditorDocument;
  viewport: EditorViewport;
  cropMode: boolean;
  contentDragMode?: boolean;
  textInteractMode?: boolean;
  selectedTextId?: string | null;
  onViewportPan: (dx: number, dy: number) => void;
  onContentPan: (dxCanvas: number, dyCanvas: number) => void;
  onSelectText?: (id: string | null) => void;
  onTextDragLive?: (id: string, x: number, y: number) => void;
  onTextDragCommit?: () => void;
  onFrameLayout?: (layout: CanvasFrameLayout) => void;
  className?: string;
}

function readCssVar(
  name: string,
  fallback: string,
  el?: Element | null,
): string {
  if (typeof window === "undefined") return fallback;
  const target = el ?? window.document.documentElement;
  const value = getComputedStyle(target).getPropertyValue(name).trim();
  return value || fallback;
}

export function EditorStage({
  source,
  document: doc,
  viewport,
  cropMode,
  contentDragMode = false,
  textInteractMode = false,
  selectedTextId = null,
  onViewportPan,
  onContentPan,
  onSelectText,
  onTextDragLive,
  onTextDragCommit,
  onFrameLayout,
  className = "",
}: EditorStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<CanvasFrameLayout | null>(null);
  const panRef = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
    pointerId: number | null;
    space: boolean;
    mode: "viewport" | "content" | "text" | null;
    textId: string | null;
  }>({
    active: false,
    lastX: 0,
    lastY: 0,
    pointerId: null,
    space: false,
    mode: null,
    textId: null,
  });

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    const themeRoot =
      wrap.closest("[data-image-editor-workspace]") ??
      window.document.documentElement;
    const themeAttr =
      typeof window !== "undefined"
        ? window.document.documentElement.getAttribute("data-theme")
        : "dark";
    const theme = themeAttr === "bright" ? "bright" : "dark";
    const pasteboard = readCssVar(
      "--ie-pasteboard",
      theme === "bright" ? "#e6e3de" : "#0b0c10",
      themeRoot,
    );
    const canvasFill = theme === "bright" ? "#ffffff" : "#161922";

    paintStage(canvas, source, doc, viewport, {
      cssWidth,
      cssHeight,
      dpr,
      showUncropped: cropMode,
      pasteboard,
      canvasFill,
      theme,
      selectedTextId: textInteractMode ? selectedTextId : null,
      onFrameLayout: (layout) => {
        layoutRef.current = layout;
        onFrameLayout?.(layout);
      },
    });
  }, [
    source,
    doc,
    viewport,
    cropMode,
    onFrameLayout,
    selectedTextId,
    textInteractMode,
  ]);

  useEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    const onFonts = () => paint();
    document.fonts.addEventListener("loadingdone", onFonts);
    return () => document.fonts.removeEventListener("loadingdone", onFonts);
  }, [paint]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [paint]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") panRef.current.space = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") panRef.current.space = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const clientToCanvas = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return null;
    const rect = canvas.getBoundingClientRect();
    return stagePointToCanvasPoint(
      { x: clientX - rect.left, y: clientY - rect.top },
      layout,
    );
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (cropMode) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;

    const space = panRef.current.space;
    let mode: "viewport" | "content" | "text" = space
      ? "viewport"
      : contentDragMode
        ? "content"
        : "viewport";
    let textId: string | null = null;

    if (textInteractMode && !space) {
      const pt = clientToCanvas(event.clientX, event.clientY);
      if (pt) {
        const measureCtx = document.createElement("canvas").getContext("2d");
        if (measureCtx) {
          const hit = hitTestTextsTopFirst(
            pt.x,
            pt.y,
            doc.texts,
            (t) => createCanvasMeasureWidth(measureCtx, t),
          );
          if (hit) {
            mode = "text";
            textId = hit;
            onSelectText?.(hit);
          } else {
            onSelectText?.(null);
            mode = "viewport";
          }
        }
      }
    }

    panRef.current = {
      active: true,
      lastX: event.clientX,
      lastY: event.clientY,
      pointerId: event.pointerId,
      space,
      mode,
      textId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!panRef.current.active) return;
    if (
      panRef.current.pointerId !== null &&
      event.pointerId !== panRef.current.pointerId
    ) {
      return;
    }
    const dx = event.clientX - panRef.current.lastX;
    const dy = event.clientY - panRef.current.lastY;
    panRef.current.lastX = event.clientX;
    panRef.current.lastY = event.clientY;
    if (dx === 0 && dy === 0) return;

    const layout = layoutRef.current;
    if (panRef.current.mode === "text" && panRef.current.textId && layout) {
      const selected = doc.texts.find((t) => t.id === panRef.current.textId);
      if (selected && onTextDragLive) {
        const dxCanvas = dx / layout.scale;
        const dyCanvas = dy / layout.scale;
        onTextDragLive(
          panRef.current.textId,
          selected.x + dxCanvas,
          selected.y + dyCanvas,
        );
      }
      return;
    }

    if (panRef.current.mode === "content" && layout && layout.scale !== 0) {
      onContentPan(dx / layout.scale, dy / layout.scale);
      return;
    }

    onViewportPan(dx, dy);
  };

  const endPan = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!panRef.current.active) return;
    const wasText = panRef.current.mode === "text";
    panRef.current.active = false;
    panRef.current.pointerId = null;
    panRef.current.mode = null;
    panRef.current.textId = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    if (wasText) onTextDragCommit?.();
  };

  const cursorClass = cropMode
    ? "cursor-default"
    : textInteractMode
      ? "cursor-default"
      : contentDragMode
        ? "cursor-move"
        : "cursor-grab active:cursor-grabbing";

  return (
    <div
      ref={wrapRef}
      className={`relative h-full min-h-0 w-full overflow-hidden ${className}`.trim()}
      data-editor-stage=""
    >
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full touch-none ${cursorClass}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      />
    </div>
  );
}
