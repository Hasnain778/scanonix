"use client";

import { useEffect, useRef, useState } from "react";
import { configurePdfWorker } from "@/lib/pdf/configure-worker";
import { loadPdfDocument as loadPdfJsDocument } from "@/lib/tools/pdf-to-image/pdf-render";
import { getPlacementsForPage } from "@/lib/tools/sign-pdf/placement-ui";
import type { NormalizedPlacement } from "@/lib/tools/sign-pdf/types";
import { SignaturePlacementOverlay } from "./SignaturePlacementOverlay";

interface SignatureAssetView {
  previewUrl: string;
  aspectRatio: number;
}

interface PdfPageEditorProps {
  pageNumber: number;
  pdfBytes: ArrayBuffer;
  placements: NormalizedPlacement[];
  assets: Record<string, SignatureAssetView>;
  selectedPlacementId: string | null;
  disabled?: boolean;
  onSelectPlacement: (placementId: string | null) => void;
  onUpdatePlacement: (placement: NormalizedPlacement) => void;
  onDeletePlacement: (placementId: string) => void;
}

export function PdfPageEditor({
  pageNumber,
  pdfBytes,
  placements,
  assets,
  selectedPlacementId,
  disabled = false,
  onSelectPlacement,
  onUpdatePlacement,
  onDeletePlacement,
}: PdfPageEditorProps) {
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderError, setRenderError] = useState<string>();
  const renderKeyRef = useRef(0);

  const pagePlacements = getPlacementsForPage(placements, pageNumber - 1);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const renderKey = ++renderKeyRef.current;

    async function renderPage() {
      setIsRendering(true);
      setRenderError(undefined);

      try {
        await configurePdfWorker();
        const pdf = await loadPdfJsDocument(pdfBytes);
        const page = await pdf.getPage(pageNumber);
        const containerWidth = Math.min(
          920,
          Math.max(280, document.documentElement.clientWidth - 48),
        );
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas is not supported in this browser.");
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;

        if (cancelled || renderKey !== renderKeyRef.current) return;

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (value) => {
              if (value) resolve(value);
              else reject(new Error("Failed to render page preview."));
            },
            "image/jpeg",
            0.92,
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
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [pageNumber, pdfBytes]);

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
          data-sign-page-overlay-root
          className="relative mx-auto w-full max-w-full border border-border bg-white shadow-lg"
          onPointerDown={() => onSelectPlacement(null)}
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
                alt={`PDF page ${pageNumber}`}
                className="block h-auto w-full select-none"
                draggable={false}
              />
              <div className="absolute inset-0">
                {pagePlacements.map((placement) => {
                  const asset = assets[placement.signatureAssetId];
                  if (!asset) return null;
                  return (
                    <SignaturePlacementOverlay
                      key={placement.id}
                      placement={placement}
                      previewUrl={asset.previewUrl}
                      aspectRatio={asset.aspectRatio}
                      selected={selectedPlacementId === placement.id}
                      disabled={disabled}
                      onSelect={() => onSelectPlacement(placement.id)}
                      onChange={onUpdatePlacement}
                      onDelete={() => onDeletePlacement(placement.id)}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
