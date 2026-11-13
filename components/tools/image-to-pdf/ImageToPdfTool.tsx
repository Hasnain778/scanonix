"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { PremiumFileSelect } from "@/components/tools/premium/PremiumFileSelect";
import {
  ImagePreviewGrid,
  nextRotation,
} from "@/components/tools/ImagePreviewGrid";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import "@/styles/ordered-collection-premium.css";
import "@/styles/ux-reset-file-pair.css";
import { createProcessAttempt } from "@/lib/analytics/process-lifecycle";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";
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

const PRIVACY_MESSAGE =
  "Processed in your browser. Images are not uploaded.";

const PAGE_SIZE_OPTIONS: {
  value: PageSize;
  label: string;
  description: string;
}[] = [
  { value: "a4", label: "A4", description: "210 × 297 mm" },
  { value: "letter", label: "Letter", description: "8.5 × 11 in" },
  {
    value: "fit",
    label: "Fit Image",
    description: "Page matches image size",
  },
];

const ORIENTATION_OPTIONS: { value: PageOrientation; label: string }[] = [
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
];

function pageSizeLabel(pageSize: PageSize): string {
  switch (pageSize) {
    case "a4":
      return "A4";
    case "letter":
      return "Letter";
    case "fit":
      return "Fit Image";
  }
}

export function ImageToPdfTool() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [orientation, setOrientation] = useState<PageOrientation>("portrait");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [resultFilename, setResultFilename] = useState(
    "scanonix-images.pdf",
  );
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();
  const [progress, setProgress] = useState<{ current: number; total: number }>();
  const [isDownloading, setIsDownloading] = useState(false);
  /** Presentational only — does not clear the result blob (preserves stale-result semantics). */
  const [showSettingsAfterResult, setShowSettingsAfterResult] = useState(false);

  const pdfBlobRef = useRef<Blob | null>(null);
  const imagesRef = useRef<ImageItem[]>([]);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  const isBusy = status === "loading" || isDownloading;
  const hasResult = pdfBlob !== null && status === "success";
  const showResultInspector = hasResult && !showSettingsAfterResult;

  const totalInputBytes = useMemo(
    () => images.reduce((sum, item) => sum + item.file.size, 0),
    [images],
  );

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
    const accepted = files.filter(isAcceptedImageFile);
    if (accepted.length === 0) {
      if (files.length > 0) {
        setStatus("error");
        setStatusMessage("Choose a JPG, JPEG, or PNG image.");
      }
      return;
    }

    const newImages: ImageItem[] = accepted.map((file) => ({
      id: createImageId(),
      file,
      previewUrl: URL.createObjectURL(file),
      rotation: 0,
    }));

    setImages((current) => [...current, ...newImages]);
    setStatus("idle");
    setStatusMessage(undefined);
    setPdfBlob(null);
    setShowSettingsAfterResult(false);
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
    setShowSettingsAfterResult(false);
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
    setShowSettingsAfterResult(false);
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
    setShowSettingsAfterResult(false);
  }, []);

  const clearAll = useCallback(() => {
    setImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
    pdfBlobRef.current = null;
    setPdfBlob(null);
    setResultFilename("scanonix-images.pdf");
    setStatus("idle");
    setStatusMessage(undefined);
    setProgress(undefined);
    setIsDownloading(false);
    setShowSettingsAfterResult(false);
  }, []);

  const handleChangeSettings = useCallback(() => {
    // Presentational return to settings only — does not invalidate result blob.
    setShowSettingsAfterResult(true);
  }, []);

  const handleGenerate = async () => {
    if (images.length === 0 || isBusy) return;

    const attempt = createProcessAttempt("image-to-pdf");

    const gate = await gateToolOperation("image-to-pdf");
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
    setShowSettingsAfterResult(false);

    try {
      const blob = await generateImagesToPdf(
        images,
        { pageSize, orientation },
        (current, total) => setProgress({ current, total }),
      );

      const filename = createPdfFilename("scanonix-images");
      setResultFilename(filename);
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
      downloadBlob(
        blob,
        resultFilename,
        buildToolDownloadMeta("image-to-pdf", 1),
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAddMoreChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (files.length > 0) {
      addFiles(files);
    }
  };

  const resultSummary = showResultInspector && pdfBlob
    ? [
        `${images.length} page${images.length === 1 ? "" : "s"}`,
        formatFileSize(pdfBlob.size),
        pageSizeLabel(pageSize),
        pageSize === "fit" ? null : orientation,
        resultFilename,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="ux-premium ux-reset-file ordered-collection-premium overflow-x-hidden">
      <ToolStatusBanner
        status={status}
        message={statusMessage}
        progress={progress}
      />

      {images.length === 0 ? (
        <div data-tool-workspace="empty">
          <PremiumFileSelect
            conversion="images-to-pdf"
            buttonLabel="Upload images"
            prompt="Upload or drag images here."
            formats="JPG, JPEG, PNG"
            accept={ACCEPTED_IMAGE_EXTENSIONS}
            validateFile={isAcceptedImageFile}
            disabled={isBusy}
            onFilesSelected={addFiles}
            onInvalidFiles={() => {
              setStatus("error");
              setStatusMessage("Choose a JPG, JPEG, or PNG image.");
            }}
          />
          <PrivacyNotice message={PRIVACY_MESSAGE} />
        </div>
      ) : (
        <div className="ux-workspace" data-tool-workspace="active">
          <div className="ux-stage">
          <div className="ux-command">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {images.length} image{images.length === 1 ? "" : "s"}
              </p>
              <p className="truncate text-xs text-foreground-muted">
                {formatFileSize(totalInputBytes)} · {images.length} PDF page
                {images.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="ux-command-actions">
              <input
                ref={addMoreInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_EXTENSIONS}
                multiple
                className="sr-only"
                disabled={isBusy}
                onChange={handleAddMoreChange}
              />
              <ActionButton
                variant="ghost"
                size="sm"
                disabled={isBusy}
                onClick={() => addMoreInputRef.current?.click()}
              >
                Add more
              </ActionButton>
              <ActionButton
                variant="ghost"
                size="sm"
                disabled={isBusy}
                onClick={clearAll}
              >
                Start over
              </ActionButton>
              {showResultInspector ? (
                <ActionButton
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={handleChangeSettings}
                >
                  Change settings
                </ActionButton>
              ) : null}
              <ActionButton
                size="lg"
                className="ux-command-primary"
                loading={showResultInspector ? isDownloading : status === "loading"}
                disabled={showResultInspector ? isBusy : images.length === 0 || isBusy}
                onClick={() => {
                  if (showResultInspector) {
                    void handleDownload();
                  } else {
                    void handleGenerate();
                  }
                }}
              >
                {showResultInspector
                  ? "Download PDF"
                  : status === "loading"
                    ? "Generating PDF…"
                    : "Generate PDF"}
              </ActionButton>
            </div>
          </div>

          {resultSummary ? (
            <p className="ux-result-line truncate">{resultSummary}</p>
          ) : null}

          <div className="ux-preview-stage space-y-3">
            <p className="text-center text-sm text-foreground-muted">
              Drag images to set the page order.
            </p>
            <ImagePreviewGrid
              images={images}
              onRemove={removeImage}
              onRotate={rotateImage}
              onReorder={reorderImages}
              showHeading={false}
              disabled={isBusy}
            />
          </div>

          {resultSummary ? null : (
            <details className="ux-setup">
              <summary className="cursor-pointer text-sm text-foreground-muted">
                Page setup
                <span className="text-foreground">
                  {" "}
                  · {pageSizeLabel(pageSize)}
                  {pageSize === "fit" ? "" : `, ${orientation}`}
                </span>
              </summary>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {PAGE_SIZE_OPTIONS.map((option) => {
                    const selected = pageSize === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={isBusy}
                        aria-pressed={selected}
                        onClick={() => setPageSize(option.value)}
                        className={`rounded-lg border px-3 py-1.5 text-sm ${
                          selected
                            ? "border-foreground bg-surface-muted text-foreground"
                            : "border-border text-foreground-muted hover:text-foreground"
                        } ${isBusy ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-foreground-muted">
                  {PAGE_SIZE_OPTIONS.find((option) => option.value === pageSize)?.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ORIENTATION_OPTIONS.map((option) => {
                    const selected = orientation === option.value;
                    const disabled = isBusy || pageSize === "fit";
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={disabled}
                        aria-pressed={selected}
                        onClick={() => setOrientation(option.value)}
                        className={`rounded-lg border px-3 py-1.5 text-sm ${
                          selected
                            ? "border-foreground bg-surface-muted text-foreground"
                            : "border-border text-foreground-muted hover:text-foreground"
                        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
