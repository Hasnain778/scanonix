"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { configurePdfWorker } from "@/lib/pdf/configure-worker";
import {
  computeFillPdfEditorContainerWidth,
  computeFillPdfZoomedDisplaySize,
} from "@/lib/tools/fill-pdf/workspace-ui";
import {
  buildPageFieldOverlays,
  type PageFieldOverlayEntry,
} from "@/lib/tools/fill-pdf/preview-geometry";
import type { FormEditState, FormFieldDescriptor } from "@/lib/tools/fill-pdf/types";
import type { FormTextFormatState } from "@/lib/tools/fill-pdf/text-appearance";
import {
  CROP_PREVIEW_JPEG_QUALITY,
  computeCropPreviewRenderPlan,
} from "@/lib/tools/crop-pdf/preview-render";
import { loadPdfDocument as loadPdfJsDocument } from "@/lib/tools/pdf-to-image/pdf-render";
import { DirectFormFieldOverlay } from "./DirectFormFieldOverlay";

interface PdfFormPreviewProps {
  pdfBytes: ArrayBuffer;
  pageCount: number;
  currentPageIndex: number;
  fields: FormFieldDescriptor[];
  editState: FormEditState;
  textFormatState: FormTextFormatState;
  fieldErrors: Record<string, string>;
  selectedFieldName: string | null;
  zoomFactor: number;
  disabled?: boolean;
  onFieldChange: (nextState: FormEditState, fieldName: string) => void;
  onFieldSelect: (fieldName: string) => void;
}

export function PdfFormPreview({
  pdfBytes,
  pageCount,
  currentPageIndex,
  fields,
  editState,
  textFormatState,
  fieldErrors,
  selectedFieldName,
  zoomFactor,
  disabled = false,
  onFieldChange,
  onFieldSelect,
}: PdfFormPreviewProps) {
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderError, setRenderError] = useState<string>();
  const [baseDisplaySize, setBaseDisplaySize] = useState<{
    width: number;
    height: number;
  }>();
  const [pageRotation, setPageRotation] = useState(0);
  const renderKeyRef = useRef(0);
  const canvasHostRef = useRef<HTMLDivElement>(null);

  const descriptorByName = useMemo(
    () => new Map(fields.map((field) => [field.name, field])),
    [fields],
  );

  const pageOverlays = useMemo(
    () => buildPageFieldOverlays(fields, currentPageIndex),
    [fields, currentPageIndex],
  );

  const displaySize = useMemo(() => {
    if (!baseDisplaySize) {
      return undefined;
    }

    return computeFillPdfZoomedDisplaySize(
      baseDisplaySize.width,
      baseDisplaySize.height,
      zoomFactor,
    );
  }, [baseDisplaySize, zoomFactor]);

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
        const page = await pdf.getPage(currentPageIndex + 1);
        const rotation = page.rotate ?? 0;
        setPageRotation(rotation);
        const baseViewport = page.getViewport({ scale: 1, rotation });
        const hostWidth =
          canvasHostRef.current?.clientWidth ??
          computeFillPdfEditorContainerWidth(window.innerWidth);
        const containerWidth = computeFillPdfEditorContainerWidth(hostWidth);
        const plan = computeCropPreviewRenderPlan({
          viewportWidth: baseViewport.width,
          viewportHeight: baseViewport.height,
          containerCssWidth: containerWidth,
          devicePixelRatio: window.devicePixelRatio,
        });
        const viewport = page.getViewport({ scale: plan.scale, rotation });

        setBaseDisplaySize({ width: plan.cssWidth, height: plan.cssHeight });

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
  }, [currentPageIndex, pdfBytes]);

  useEffect(() => {
    return () => {
      if (pageImageUrl) {
        URL.revokeObjectURL(pageImageUrl);
      }
    };
  }, [pageImageUrl]);

  useEffect(() => {
    if (!selectedFieldName) {
      return;
    }

    const node = canvasHostRef.current?.querySelector<HTMLElement>(
      `[data-field-name="${CSS.escape(selectedFieldName)}"]`,
    );
    node?.focus({ preventScroll: false });
  }, [selectedFieldName, currentPageIndex, pageOverlays.length]);

  return (
    <div
      ref={canvasHostRef}
      data-fill-pdf-editor-canvas
      className="flex w-full justify-center overflow-x-auto px-1 py-2 sm:px-2"
    >
      <div
        data-fill-pdf-preview-root
        className="relative shrink-0 bg-white shadow-xl shadow-black/40"
        style={
          displaySize
            ? { width: displaySize.width, height: displaySize.height }
            : { width: "100%", minHeight: 420 }
        }
      >
        {isRendering && (
          <div className="flex min-h-[420px] items-center justify-center bg-[#1a1a1a] text-sm text-scanonix-muted">
            Rendering page…
          </div>
        )}
        {renderError && (
          <div className="flex min-h-[420px] items-center justify-center bg-[#1a1a1a] px-4 text-center text-sm text-red-300">
            {renderError}
          </div>
        )}
        {pageImageUrl && !isRendering && !renderError && displaySize && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pageImageUrl}
              alt={`PDF page ${currentPageIndex + 1} of ${pageCount}`}
              className="block h-full w-full select-none object-fill"
              draggable={false}
            />
            <div className="absolute inset-0">
              {pageOverlays.map((overlay: PageFieldOverlayEntry) => {
                const descriptor = descriptorByName.get(overlay.fieldName);
                const value = editState[overlay.fieldName];
                if (!descriptor || !value) {
                  return null;
                }

                return (
                  <DirectFormFieldOverlay
                    key={`${overlay.fieldName}-${overlay.widgetIndex}`}
                    overlay={overlay}
                    descriptor={descriptor}
                    value={value}
                    editState={editState}
                    textFormat={textFormatState[overlay.fieldName]}
                    pageDisplayHeightPx={displaySize.height}
                    selected={selectedFieldName === overlay.fieldName}
                    disabled={disabled}
                    error={fieldErrors[overlay.fieldName]}
                    onChange={onFieldChange}
                    onSelect={onFieldSelect}
                  />
                );
              })}
            </div>
          </>
        )}
        {pageRotation !== 0 && !isRendering && !renderError && (
          <span className="sr-only">Page rotation: {pageRotation} degrees</span>
        )}
      </div>
    </div>
  );
}
