"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { configurePdfWorker } from "@/lib/pdf/configure-worker";
import {
  CROP_PREVIEW_JPEG_QUALITY,
  computeCropPreviewContainerWidth,
  computeCropPreviewRenderPlan,
  computePreviewOverlayStyle,
  resolvePreviewNumbering,
  type PageNumberFormat,
  type PageNumberPageEntry,
  type PageNumberPosition,
} from "@/lib/tools/add-page-numbers";
import { loadPdfDocument as loadPdfJsDocument } from "@/lib/tools/pdf-to-image/pdf-render";

interface PageNumberPreviewProps {
  pageEntry: PageNumberPageEntry;
  pdfBytes: ArrayBuffer;
  pageCount: number;
  currentPageIndex: number;
  onPageChange: (index: number) => void;
  allPages: boolean;
  pageRangeInput: string;
  startingNumber: number;
  format: PageNumberFormat;
  position: PageNumberPosition;
  fontSize: number;
  margin: number;
  color: string;
  disabled?: boolean;
}

function measureTextWidth(text: string, fontSize: number): number {
  if (typeof document === "undefined") {
    return text.length * fontSize * 0.5;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return text.length * fontSize * 0.5;
  }

  context.font = `${fontSize}px Helvetica, Arial, sans-serif`;
  return context.measureText(text).width;
}

export function PageNumberPreview({
  pageEntry,
  pdfBytes,
  pageCount,
  currentPageIndex,
  onPageChange,
  allPages,
  pageRangeInput,
  startingNumber,
  format,
  position,
  fontSize,
  margin,
  color,
  disabled = false,
}: PageNumberPreviewProps) {
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderError, setRenderError] = useState<string>();
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number }>();
  const renderKeyRef = useRef(0);

  const previewNumbering = useMemo(
    () =>
      resolvePreviewNumbering(
        allPages,
        pageRangeInput,
        pageCount,
        currentPageIndex,
        startingNumber,
        format,
      ),
    [
      allPages,
      pageRangeInput,
      pageCount,
      currentPageIndex,
      startingNumber,
      format,
    ],
  );

  const textWidth = useMemo(() => {
    if (!previewNumbering.text) return 0;
    return measureTextWidth(previewNumbering.text, fontSize);
  }, [previewNumbering.text, fontSize]);

  const overlayStyle = useMemo(() => {
    if (!previewNumbering.isNumbered || !previewNumbering.text || !displaySize) {
      return null;
    }

    return computePreviewOverlayStyle({
      pageEntry,
      position,
      margin,
      fontSize,
      textWidth,
      color,
      cssHeight: displaySize.height,
    });
  }, [
    previewNumbering.isNumbered,
    previewNumbering.text,
    displaySize,
    pageEntry,
    position,
    margin,
    fontSize,
    textWidth,
    color,
  ]);

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
        const containerWidth = computeCropPreviewContainerWidth(
          document.documentElement.clientWidth,
        );
        const plan = computeCropPreviewRenderPlan({
          viewportWidth: baseViewport.width,
          viewportHeight: baseViewport.height,
          containerCssWidth: containerWidth,
          devicePixelRatio: window.devicePixelRatio,
        });
        const viewport = page.getViewport({ scale: plan.scale, rotation });

        setDisplaySize({ width: plan.cssWidth, height: plan.cssHeight });

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
  }, [pageEntry.sourcePageIndex, pageEntry.intrinsicRotation, pdfBytes]);

  useEffect(() => {
    return () => {
      if (pageImageUrl) {
        URL.revokeObjectURL(pageImageUrl);
      }
    };
  }, [pageImageUrl]);

  return (
    <div className="w-full overflow-x-hidden">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Preview</h2>
          <p className="mt-1 text-sm text-scanonix-muted">
            Page {currentPageIndex + 1} of {pageCount}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            variant="outline"
            size="sm"
            disabled={currentPageIndex <= 0 || disabled || isRendering}
            onClick={() => onPageChange(Math.max(0, currentPageIndex - 1))}
          >
            Previous
          </ActionButton>
          <label className="sr-only" htmlFor="add-page-numbers-page-select">
            Select page
          </label>
          <select
            id="add-page-numbers-page-select"
            value={currentPageIndex}
            disabled={disabled || isRendering}
            onChange={(event) => onPageChange(Number(event.target.value))}
            className="rounded-xl border border-scanonix-border bg-black/40 px-3 py-2 text-sm text-white focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
          >
            {Array.from({ length: pageCount }, (_, index) => (
              <option key={index} value={index}>
                Page {index + 1}
              </option>
            ))}
          </select>
          <ActionButton
            variant="outline"
            size="sm"
            disabled={currentPageIndex >= pageCount - 1 || disabled || isRendering}
            onClick={() =>
              onPageChange(Math.min(pageCount - 1, currentPageIndex + 1))
            }
          >
            Next
          </ActionButton>
        </div>
      </div>

      <div className="mx-auto max-w-full">
        <div
          data-page-number-preview-root
          className="relative mx-auto border border-scanonix-border bg-white shadow-lg"
          style={
            displaySize
              ? { width: displaySize.width, maxWidth: "100%" }
              : { width: "100%", maxWidth: "100%" }
          }
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
                alt={`PDF page ${currentPageIndex + 1}`}
                className="block h-auto w-full select-none"
                draggable={false}
              />
              {previewNumbering.isNumbered && overlayStyle && previewNumbering.text && (
                <span
                  className="pointer-events-none absolute whitespace-nowrap font-sans leading-none"
                  style={{
                    left: overlayStyle.left,
                    top: overlayStyle.top,
                    bottom: overlayStyle.bottom,
                    fontSize: overlayStyle.fontSize,
                    color: overlayStyle.color,
                  }}
                  aria-hidden="true"
                >
                  {previewNumbering.text}
                </span>
              )}
              {!previewNumbering.isNumbered && (
                <div className="absolute inset-x-0 bottom-0 bg-black/70 px-4 py-3 text-center text-sm text-white">
                  This page will not be numbered.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
