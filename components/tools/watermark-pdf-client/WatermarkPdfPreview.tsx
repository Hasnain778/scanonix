"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { configurePdfWorker } from "@/lib/pdf/configure-worker";
import {
  CROP_PREVIEW_JPEG_QUALITY,
  computeImagePreviewOverlayStyle,
  computeTextPreviewOverlayStyle,
  measurePreviewTextWidth,
  resolvePreviewWatermark,
  canUseBoldInWorkspace,
  type WatermarkPageEntry,
  type WatermarkPosition,
  type WatermarkType,
} from "@/lib/tools/watermark-pdf";
import {
  computeWatermarkPreviewDisplaySize,
  resolveWatermarkPreviewContainerWidth,
} from "@/lib/tools/watermark-pdf/preview-render";
import { loadPdfDocument as loadPdfJsDocument } from "@/lib/tools/pdf-to-image/pdf-render";

interface WatermarkPdfPreviewProps {
  pageEntry: WatermarkPageEntry;
  pdfBytes: ArrayBuffer;
  pageCount: number;
  currentPageIndex: number;
  mode: WatermarkType;
  text: string;
  position: WatermarkPosition;
  opacityPercent: number;
  fontSize: number;
  bold: boolean;
  color: string;
  margin: number;
  rotationDegrees: number;
  relativeWidthPercent: number;
  imagePreviewUrl: string | null;
  imageIntrinsicWidth: number;
  imageIntrinsicHeight: number;
  allPages: boolean;
  pageRangeInput: string;
}

export function WatermarkPdfPreview({
  pageEntry,
  pdfBytes,
  pageCount,
  currentPageIndex,
  mode,
  text,
  position,
  opacityPercent,
  fontSize,
  bold,
  color,
  margin,
  rotationDegrees,
  relativeWidthPercent,
  imagePreviewUrl,
  imageIntrinsicWidth,
  imageIntrinsicHeight,
  allPages,
  pageRangeInput,
}: WatermarkPdfPreviewProps) {
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderError, setRenderError] = useState<string>();
  const [containerWidth, setContainerWidth] = useState(640);
  const renderKeyRef = useRef(0);
  const measureRef = useRef<HTMLDivElement>(null);

  const previewSelection = useMemo(
    () =>
      resolvePreviewWatermark(
        allPages,
        pageRangeInput,
        pageCount,
        currentPageIndex,
      ),
    [allPages, pageRangeInput, pageCount, currentPageIndex],
  );

  const previewLayout = useMemo(
    () =>
      computeWatermarkPreviewDisplaySize(
        pageEntry,
        containerWidth,
        typeof window !== "undefined" ? window.devicePixelRatio : 1,
      ),
    [pageEntry, containerWidth],
  );

  const displaySize = useMemo(
    () => ({ width: previewLayout.width, height: previewLayout.height }),
    [previewLayout.width, previewLayout.height],
  );

  const opacity = opacityPercent / 100;
  const useBold = canUseBoldInWorkspace(text, bold);
  const trimmedText = text.trim();

  const textWidth = useMemo(() => {
    if (mode !== "text" || !trimmedText) return 0;
    return measurePreviewTextWidth(trimmedText, fontSize, useBold);
  }, [mode, trimmedText, fontSize, useBold]);

  const textOverlayStyle = useMemo(() => {
    if (
      mode !== "text" ||
      !previewSelection.isWatermarked ||
      !trimmedText ||
      !displaySize
    ) {
      return null;
    }

    return computeTextPreviewOverlayStyle({
      pageEntry,
      position,
      margin,
      fontSize,
      textWidth,
      color,
      opacity,
      rotationDegrees,
      bold: useBold,
      cssHeight: displaySize.height,
    });
  }, [
    mode,
    previewSelection.isWatermarked,
    trimmedText,
    displaySize,
    pageEntry,
    position,
    margin,
    fontSize,
    textWidth,
    color,
    opacity,
    rotationDegrees,
    useBold,
  ]);

  const imageOverlayStyle = useMemo(() => {
    if (
      mode !== "image" ||
      !previewSelection.isWatermarked ||
      !imagePreviewUrl ||
      imageIntrinsicWidth <= 0 ||
      imageIntrinsicHeight <= 0
    ) {
      return null;
    }

    return computeImagePreviewOverlayStyle({
      pageEntry,
      position,
      margin,
      intrinsicWidth: imageIntrinsicWidth,
      intrinsicHeight: imageIntrinsicHeight,
      relativeWidthRatio: relativeWidthPercent / 100,
      opacity,
      rotationDegrees,
    });
  }, [
    mode,
    previewSelection.isWatermarked,
    imagePreviewUrl,
    imageIntrinsicWidth,
    imageIntrinsicHeight,
    pageEntry,
    position,
    margin,
    relativeWidthPercent,
    opacity,
    rotationDegrees,
  ]);

  useEffect(() => {
    const host = measureRef.current;
    if (!host) return;

    const updateWidth = () => {
      const measured = host.clientWidth || window.innerWidth * 0.7;
      setContainerWidth((current) =>
        resolveWatermarkPreviewContainerWidth(current, measured),
      );
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    let renderTask: { cancel: () => void } | null = null;
    const renderKey = ++renderKeyRef.current;
    const renderPlan = computeWatermarkPreviewDisplaySize(
      pageEntry,
      containerWidth,
      window.devicePixelRatio,
    ).plan;

    async function renderPage() {
      setIsRendering(true);
      setRenderError(undefined);

      try {
        await configurePdfWorker();
        const pdf = await loadPdfJsDocument(pdfBytes);
        const page = await pdf.getPage(pageEntry.sourcePageIndex + 1);
        const rotation = pageEntry.intrinsicRotation;
        const viewport = page.getViewport({ scale: renderPlan.scale, rotation });

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
  }, [
    pageEntry.sourcePageIndex,
    pageEntry.intrinsicRotation,
    pageEntry.mediaBox.width,
    pageEntry.mediaBox.height,
    pageEntry.cropBox.width,
    pageEntry.cropBox.height,
    pdfBytes,
    containerWidth,
  ]);

  useEffect(() => {
    return () => {
      if (pageImageUrl) {
        URL.revokeObjectURL(pageImageUrl);
      }
    };
  }, [pageImageUrl]);

  const showExcludedBanner =
    !previewSelection.isWatermarked && !previewSelection.selectionError;

  return (
    <div ref={measureRef} className="w-full overflow-x-hidden">
      <div className="mx-auto max-w-full">
        <div
          data-watermark-pdf-preview-canvas
          data-watermark-pdf-preview-root
          className="relative mx-auto overflow-hidden border border-border bg-white shadow-lg"
          style={
            displaySize
              ? {
                  width: displaySize.width,
                  height: displaySize.height,
                  maxWidth: "100%",
                }
              : { width: "100%", maxWidth: "100%", minHeight: 420 }
          }
        >
          {!pageImageUrl && isRendering && (
            <div className="flex h-full min-h-[420px] items-center justify-center bg-surface-muted text-sm text-foreground-muted">
              Rendering page…
            </div>
          )}
          {renderError && (
            <div className="flex h-full min-h-[420px] items-center justify-center bg-surface-muted px-4 text-center text-sm text-red-600">
              {renderError}
            </div>
          )}
          {pageImageUrl && !renderError && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pageImageUrl}
                alt={`PDF page ${currentPageIndex + 1}`}
                className="block h-full w-full select-none object-fill"
                draggable={false}
              />

              {isRendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-foreground-muted">
                  Rendering page…
                </div>
              )}

              {mode === "text" && textOverlayStyle && trimmedText && (
                <span
                  data-watermark-pdf-overlay
                  data-watermark-pdf-text-overlay
                  className="pointer-events-none absolute whitespace-nowrap font-sans leading-none"
                  style={{
                    left: textOverlayStyle.left,
                    top: textOverlayStyle.top,
                    fontSize: textOverlayStyle.fontSize,
                    color: textOverlayStyle.color,
                    opacity: textOverlayStyle.opacity,
                    transform: textOverlayStyle.transform,
                    transformOrigin: textOverlayStyle.transformOrigin,
                    fontWeight: textOverlayStyle.fontWeight,
                  }}
                  aria-hidden="true"
                >
                  {trimmedText}
                </span>
              )}

              {mode === "image" && imageOverlayStyle && imagePreviewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreviewUrl}
                  alt=""
                  data-watermark-pdf-overlay
                  data-watermark-pdf-image-overlay
                  className="pointer-events-none absolute object-contain"
                  style={{
                    left: imageOverlayStyle.left,
                    top: imageOverlayStyle.top,
                    bottom: imageOverlayStyle.bottom,
                    width: imageOverlayStyle.width,
                    height: imageOverlayStyle.height,
                    opacity: imageOverlayStyle.opacity,
                    transform: imageOverlayStyle.transform,
                    transformOrigin: imageOverlayStyle.transformOrigin,
                  }}
                  aria-hidden="true"
                />
              )}

              {showExcludedBanner && (
                <div
                  data-watermark-pdf-excluded-banner
                  className="absolute inset-x-0 bottom-0 bg-black/70 px-4 py-3 text-center text-sm text-white"
                >
                  This page will not be watermarked.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
