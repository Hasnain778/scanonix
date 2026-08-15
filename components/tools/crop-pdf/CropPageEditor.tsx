"use client";

import { useEffect, useRef, useState } from "react";
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
  }, [pageEntry.id, pageEntry.sourcePageIndex, pageEntry.intrinsicRotation, pdfBytes]);

  useEffect(() => {
    return () => {
      if (pageImageUrl) {
        URL.revokeObjectURL(pageImageUrl);
      }
    };
  }, [pageImageUrl]);

  return (
    <div className="w-full overflow-x-hidden">
      <div className="mx-auto max-w-full">
        <div
          data-crop-page-overlay-root
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
