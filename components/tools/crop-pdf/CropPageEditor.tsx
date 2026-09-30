"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { configurePdfWorker } from "@/lib/pdf/configure-worker";
import {
  CROP_PREVIEW_JPEG_QUALITY,
  computeCropPreviewContainerWidth,
  computeCropPreviewRenderPlan,
  type CropPageEntry,
} from "@/lib/tools/crop-pdf";
import { loadPdfDocument as loadPdfJsDocument } from "@/lib/tools/pdf-to-image/pdf-render";
import type { NormalizedCropRect } from "@/lib/tools/crop-pdf/types";
import { CropOverlay } from "./CropOverlay";

const CROP_FIT_DESKTOP_MIN_WIDTH = 1024;
const CROP_FIT_SIDE_BLEED = 8;
const CROP_FIT_USEFUL_WIDTH = 440;
const CROP_FIT_PREFERRED_MAX = 520;
/** Below this viewport height, keep a usable page width and allow a little page scroll. */
const CROP_FIT_TALL_VIEWPORT = 860;

/**
 * Display-only fit inside the editor viewport.
 * The slot height is the available editor geometry. The page's document position is not used.
 * Crop percentages stay relative to the rendered overlay root.
 */
function readCropPreviewFitWidth(pageAspect: number, slot: HTMLElement): number {
  const slotWidth = Math.max(1, slot.clientWidth);
  if (window.innerWidth < CROP_FIT_DESKTOP_MIN_WIDTH) {
    return slotWidth;
  }

  const usableWidth = Math.max(1, slotWidth - CROP_FIT_SIDE_BLEED);
  const editorHeight = slot.clientHeight;
  if (editorHeight < 80) {
    return Math.min(usableWidth, CROP_FIT_PREFERRED_MAX);
  }

  const usableHeight = Math.max(1, editorHeight - 12);
  const heightLimitedWidth = usableHeight / pageAspect;
  const fitted = Math.min(usableWidth, CROP_FIT_PREFERRED_MAX, heightLimitedWidth);

  if (window.innerHeight < CROP_FIT_TALL_VIEWPORT) {
    const usefulFloor = Math.min(CROP_FIT_USEFUL_WIDTH, usableWidth);
    return Math.max(fitted, usefulFloor);
  }

  return fitted;
}

interface CropPageEditorProps {
  pageEntry: CropPageEntry;
  pdfBytes: ArrayBuffer;
  crop: NormalizedCropRect;
  disabled?: boolean;
  onCropChange: (crop: NormalizedCropRect) => void;
}

export function CropPageEditor({
  pageEntry,
  pdfBytes,
  crop,
  disabled = false,
  onCropChange,
}: CropPageEditorProps) {
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderError, setRenderError] = useState<string>();
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number }>();
  const renderKeyRef = useRef(0);
  const slotRef = useRef<HTMLDivElement>(null);
  const aspectRef = useRef<number | null>(null);
  const renderedWidthRef = useRef(0);

  const applyFitWidth = useCallback((aspect: number) => {
    const slot = slotRef.current;
    if (!slot) return null;
    const width = readCropPreviewFitWidth(aspect, slot);
    setDisplaySize((current) => {
      if (current && Math.abs(current.width - width) < 1) return current;
      return { width, height: width * aspect };
    });
    return width;
  }, []);

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
        const baseViewport = page.getViewport({ scale: 1, rotation });
        const pageAspect = baseViewport.height / Math.max(1, baseViewport.width);
        aspectRef.current = pageAspect;
        const fittedWidth =
          (slotRef.current ? readCropPreviewFitWidth(pageAspect, slotRef.current) : null) ??
          computeCropPreviewContainerWidth(document.documentElement.clientWidth);
        const containerWidth = fittedWidth;
        const plan = computeCropPreviewRenderPlan({
          viewportWidth: baseViewport.width,
          viewportHeight: baseViewport.height,
          containerCssWidth: containerWidth,
          devicePixelRatio: window.devicePixelRatio,
        });
        const viewport = page.getViewport({ scale: plan.scale, rotation });

        setDisplaySize({ width: plan.cssWidth, height: plan.cssHeight });
        renderedWidthRef.current = plan.cssWidth;

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
            CROP_PREVIEW_JPEG_QUALITY,
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
  }, [pageEntry.id, pageEntry.sourcePageIndex, pageEntry.intrinsicRotation, pdfBytes]);

  useEffect(() => {
    const onResize = () => {
      const aspect = aspectRef.current;
      if (!aspect) return;
      applyFitWidth(aspect);
    };

    window.addEventListener("resize", onResize);
    const slot = slotRef.current;
    const observer = typeof ResizeObserver !== "undefined" && slot ? new ResizeObserver(onResize) : null;
    observer?.observe(slot as HTMLElement);
    onResize();

    return () => {
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, [applyFitWidth, pageImageUrl]);

  useEffect(() => {
    return () => {
      if (pageImageUrl) {
        URL.revokeObjectURL(pageImageUrl);
      }
    };
  }, [pageImageUrl]);

  return (
    <div ref={slotRef} className="crop-preview-slot w-full" data-crop-preview-slot="">
      <div className="mx-auto max-w-full">
        <div
          data-crop-page-overlay-root
          className="crop-page-frame relative mx-auto border border-border bg-white shadow-lg"
          style={
            displaySize
              ? { width: displaySize.width, maxWidth: "100%" }
              : { width: "100%", maxWidth: "100%" }
          }
        >
          {isRendering && (
            <div className="flex min-h-[420px] items-center justify-center bg-surface-muted text-sm text-foreground-muted">
              Rendering page…
            </div>
          )}
          {renderError && (
            <div className="flex min-h-[420px] items-center justify-center bg-surface-muted px-4 text-center text-sm text-red-600">
              {renderError}
            </div>
          )}
          {pageImageUrl && !isRendering && !renderError && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pageImageUrl}
                alt={`PDF page ${pageEntry.sourcePageIndex + 1}`}
                className="block h-auto w-full select-none"
                draggable={false}
              />
              <CropOverlay
                crop={crop}
                disabled={disabled}
                onChange={onCropChange}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
