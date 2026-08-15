"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { configurePdfWorker } from "@/lib/pdf/configure-worker";
import {
  applyRedactPreviewZoom,
  computeRedactPreviewContainerWidth,
  computeRedactPreviewDisplaySize,
  REDACT_PREVIEW_JPEG_QUALITY,
} from "@/lib/tools/redact-pdf/preview-render";
import type { RedactionPageEntry } from "@/lib/tools/redact-pdf/types";
import { loadPdfDocument as loadPdfJsDocument } from "@/lib/tools/pdf-to-image/pdf-render";
import type { NormalizedRedactionRect } from "@/lib/tools/redact-pdf/types";
import { RedactionOverlayLayer } from "./RedactionOverlayLayer";

interface RedactPdfPreviewProps {
  pageEntry: RedactionPageEntry;
  pdfBytes: ArrayBuffer;
  redactions: Array<NormalizedRedactionRect & { id: string }>;
  selectedRedactionId: string | null;
  drawModeActive: boolean;
  zoom: number;
  disabled?: boolean;
  onSelectRedaction: (id: string | null) => void;
  onRedactionChange: (id: string, rect: NormalizedRedactionRect) => void;
  onDrawComplete: (rect: NormalizedRedactionRect) => void;
  onBaseDisplaySizeChange?: (size: { width: number; height: number }) => void;
}

export function RedactPdfPreview({
  pageEntry,
  pdfBytes,
  redactions,
  selectedRedactionId,
  drawModeActive,
  zoom,
  disabled = false,
  onSelectRedaction,
  onRedactionChange,
  onDrawComplete,
  onBaseDisplaySizeChange,
}: RedactPdfPreviewProps) {
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderError, setRenderError] = useState<string>();
  const [containerWidth, setContainerWidth] = useState(640);
  const renderKeyRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => {
      setContainerWidth(element.clientWidth || 640);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const baseDisplaySize = useMemo(
    () =>
      computeRedactPreviewDisplaySize(
        pageEntry,
        computeRedactPreviewContainerWidth(containerWidth),
        typeof window !== "undefined" ? window.devicePixelRatio : 1,
      ),
    [pageEntry, containerWidth],
  );

  const displaySize = useMemo(
    () =>
      applyRedactPreviewZoom(
        baseDisplaySize.width,
        baseDisplaySize.height,
        zoom,
      ),
    [baseDisplaySize.height, baseDisplaySize.width, zoom],
  );

  useEffect(() => {
    onBaseDisplaySizeChange?.({
      width: baseDisplaySize.width,
      height: baseDisplaySize.height,
    });
  }, [baseDisplaySize.height, baseDisplaySize.width, onBaseDisplaySizeChange]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    let renderTask: { cancel: () => void } | null = null;
    const renderKey = ++renderKeyRef.current;

    async function renderPage() {
      setIsRendering(true);
      setRenderError(undefined);

      try {
        await configurePdfWorker();
        const pdf = await loadPdfJsDocument(pdfBytes);
        const page = await pdf.getPage(pageEntry.sourcePageIndex + 1);
        const rotation = pageEntry.intrinsicRotation;
        const viewport = page.getViewport({
          scale: baseDisplaySize.plan.scale,
          rotation,
        });

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas is not supported in this browser.");
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        const task = page.render({ canvas, canvasContext: context, viewport });
        renderTask = task;
        await task.promise;

        if (cancelled || renderKey !== renderKeyRef.current) return;

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (value) => {
              if (value) resolve(value);
              else reject(new Error("Failed to render page preview."));
            },
            "image/jpeg",
            REDACT_PREVIEW_JPEG_QUALITY,
          );
        });

        objectUrl = URL.createObjectURL(blob);
        setPageImageUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return objectUrl;
        });
      } catch (error) {
        if (!cancelled) {
          setRenderError(
            error instanceof Error ? error.message : "Failed to render PDF page.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    baseDisplaySize.plan.scale,
    pageEntry.id,
    pageEntry.intrinsicRotation,
    pageEntry.sourcePageIndex,
    pdfBytes,
  ]);

  useEffect(() => {
    return () => {
      if (pageImageUrl) {
        URL.revokeObjectURL(pageImageUrl);
      }
    };
  }, [pageImageUrl]);

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <div className="mx-auto max-w-full">
        <div
          data-redact-page-overlay-root
          data-redact-draw-mode={drawModeActive ? "true" : "false"}
          className="relative mx-auto border border-scanonix-border bg-white shadow-lg"
          style={{
            width: displaySize.width,
            height: displaySize.height,
            maxWidth: "none",
          }}
        >
          {isRendering && (
            <div className="flex min-h-[420px] items-center justify-center bg-scanonix-surface text-sm text-scanonix-muted">
              Rendering page…
            </div>
          )}
          {renderError && (
            <div className="flex min-h-[420px] items-center justify-center bg-scanonix-surface px-4 text-center text-sm text-red-300">
              {renderError}
            </div>
          )}
          {pageImageUrl && !isRendering && !renderError && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pageImageUrl}
                alt={`PDF page ${pageEntry.sourcePageIndex + 1}`}
                className="block h-full w-full select-none object-fill"
                draggable={false}
              />
              <RedactionOverlayLayer
                redactions={redactions}
                selectedRedactionId={selectedRedactionId}
                drawModeActive={drawModeActive}
                disabled={disabled}
                onSelectRedaction={onSelectRedaction}
                onRedactionChange={onRedactionChange}
                onDrawComplete={onDrawComplete}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
