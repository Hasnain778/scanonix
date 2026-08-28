"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import {
  ImagePreviewGrid,
  nextRotation,
} from "@/components/tools/ImagePreviewGrid";
import { PdfOptionsPanel } from "@/components/tools/PdfOptionsPanel";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ResultActionBar } from "@/components/tools/ResultActionBar";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { gateToolOperation } from "@/lib/plan/tool-gate";
import { createPdfFilename, downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import { generateImagesToPdf } from "@/lib/tools/image-to-pdf/generate-pdf";
import { createImageId, isAcceptedImageFile } from "@/lib/tools/image-utils";
import type {
  ImageItem,
  PageOrientation,
  PageSize,
  ToolStatus,
} from "@/lib/tools/types";
import { ACCEPTED_IMAGE_EXTENSIONS } from "@/lib/tools/types";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

export function ImageToPdfTool() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [orientation, setOrientation] = useState<PageOrientation>("portrait");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();
  const [progress, setProgress] = useState<{ current: number; total: number }>();
  const [isDownloading, setIsDownloading] = useState(false);

  const pdfBlobRef = useRef<Blob | null>(null);
  const imagesRef = useRef<ImageItem[]>([]);

  const isBusy = status === "loading" || isDownloading;
  const hasResult = pdfBlob !== null && status === "success";

  /** Presentational adapter only — does not replace the ToolStatus state machine. */
  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (images.length > 0) return "ready";
    return "idle";
  }, [status, hasResult, images.length]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    pdfBlobRef.current = pdfBlob;
  }, [pdfBlob]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.previewUrl),
      );
      pdfBlobRef.current = null;
    };
  }, []);

  const addFiles = useCallback((files: File[]) => {
    const newImages: ImageItem[] = files.map((file) => ({
      id: createImageId(),
      file,
      previewUrl: URL.createObjectURL(file),
      rotation: 0,
    }));

    setImages((current) => [...current, ...newImages]);
    setStatus("idle");
    setStatusMessage(undefined);
    setPdfBlob(null);
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((current) => {
      const target = current.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((image) => image.id !== id);
    });
    setPdfBlob(null);
    setStatus("idle");
    setStatusMessage(undefined);
  }, []);

  const rotateImage = useCallback((id: string) => {
    setImages((current) =>
      current.map((image) =>
        image.id === id
          ? { ...image, rotation: nextRotation(image.rotation) }
          : image,
      ),
    );
    setPdfBlob(null);
    setStatus("idle");
    setStatusMessage(undefined);
  }, []);

  const reorderImages = useCallback((fromIndex: number, toIndex: number) => {
    setImages((current) => {
      const updated = [...current];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    setPdfBlob(null);
    setStatus("idle");
    setStatusMessage(undefined);
  }, []);

  const clearAll = useCallback(() => {
    setImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
    pdfBlobRef.current = null;
    setPdfBlob(null);
    setStatus("idle");
    setStatusMessage(undefined);
    setProgress(undefined);
    setIsDownloading(false);
  }, []);

  const handleGenerate = async () => {
    if (images.length === 0 || isBusy) return;

    const attempt = createProcessAttempt("image-to-pdf");

    const totalBytes = images.reduce((sum, item) => sum + item.file.size, 0);
    const gate = await gateToolOperation("image-to-pdf", totalBytes);
    if (!gate.ok) {
      setStatus("error");
      setStatusMessage(gate.message);
      return;
    }

    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setStatusMessage(undefined);
    setProgress({ current: 0, total: images.length });
    setPdfBlob(null);

    try {
      const blob = await generateImagesToPdf(
        images,
        { pageSize, orientation },
        (current, total) => setProgress({ current, total }),
      );

      setPdfBlob(blob);
      attempt.success(1);
      setStatus("success");
      setStatusMessage(
        `PDF with ${images.length} page${images.length === 1 ? "" : "s"} ready to download.`,
      );
      setProgress(undefined);
    } catch (error) {
      attempt.error("unknown");
      setStatus("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to generate PDF",
      );
      setProgress(undefined);
    }
  };

  const handleDownload = async () => {
    const blob = pdfBlobRef.current ?? pdfBlob;
    if (!blob || isDownloading) return;

    setIsDownloading(true);
    try {
      downloadBlob(blob, createPdfFilename("scanonix-images"), buildToolDownloadMeta("image-to-pdf", 1));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      <ToolStatusBanner
        status={status}
        message={statusMessage}
        progress={progress}
      />

      <FileDropZone
        onFilesSelected={addFiles}
        accept={ACCEPTED_IMAGE_EXTENSIONS}
        validateFile={isAcceptedImageFile}
        disabled={isBusy}
        label="Drop images here to convert to PDF"
        hint="or click to browse — JPG, JPEG, PNG"
      />

      {images.length > 0 && (
        <>
          <ImagePreviewGrid
            images={images}
            onRemove={removeImage}
            onRotate={rotateImage}
            onReorder={reorderImages}
            disabled={isBusy}
          />

          {hasResult && pdfBlob && (
            <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
              <h2 className="mb-2 text-lg font-semibold text-white">Results</h2>
              <p className="text-sm text-scanonix-muted">
                {images.length} page{images.length === 1 ? "" : "s"} ·{" "}
                {formatFileSize(pdfBlob.size)} · {pageSize.toUpperCase()}{" "}
                {orientation}
              </p>
              <div className="mt-5">
                <ResultActionBar
                  phase={resultActionPhase}
                  primary={{
                    label: "Download PDF",
                    onClick: () => {
                      void handleDownload();
                    },
                    loading: isDownloading,
                    disabled: isBusy,
                  }}
                  startOver={{
                    label: "Start over",
                    onClick: clearAll,
                    disabled: isBusy,
                  }}
                />
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <PdfOptionsPanel
              pageSize={pageSize}
              orientation={orientation}
              onPageSizeChange={setPageSize}
              onOrientationChange={setOrientation}
              disabled={isBusy}
            />

            <div className="flex flex-col justify-end gap-3">
              <ActionButton
                size="lg"
                className="w-full"
                loading={status === "loading"}
                disabled={images.length === 0 || isBusy}
                onClick={handleGenerate}
              >
                {status === "loading" ? "Generating PDF…" : "Generate PDF"}
              </ActionButton>
              {!hasResult && (
                <ActionButton
                  variant="outline"
                  className="w-full"
                  disabled={isBusy}
                  onClick={clearAll}
                >
                  Clear all
                </ActionButton>
              )}
              <PrivacyNotice />
            </div>
          </div>
        </>
      )}

      <ToolStickyMobileActionBar
        visible={hasResult}
        phase={resultActionPhase}
        primaryLabel="Download PDF"
        primaryLoading={isDownloading}
        primaryDisabled={isBusy}
        onPrimaryClick={() => {
          void handleDownload();
        }}
        onStartOver={clearAll}
        startOverLabel="Start over"
        startOverDisabled={isBusy}
      />
    </div>
  );
}
