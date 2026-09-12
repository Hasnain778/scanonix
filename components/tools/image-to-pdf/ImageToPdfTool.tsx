"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Images } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import {
  ImagePreviewGrid,
  nextRotation,
} from "@/components/tools/ImagePreviewGrid";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolControlPanel } from "@/components/workspace/ToolControlPanel";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
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
  "Your images are processed locally in your browser and never uploaded to any server. Scanonix does not store or access your documents.";

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

function ImageToPdfIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <Images className={className} aria-hidden="true" strokeWidth={1.75} />;
}

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
    const accepted = files.filter(isAcceptedImageFile);
    if (accepted.length === 0) return;

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

  const generateHint =
    images.length === 0
      ? "Add images before generating a PDF."
      : status === "loading"
        ? progress
          ? `Generating PDF… Page ${progress.current} of ${progress.total}`
          : "Generating PDF…"
        : `Ready to create ${images.length}-page PDF.`;

  return (
    <div className="space-y-5 overflow-x-hidden">
      <ToolStatusBanner
        status={status}
        message={statusMessage}
        progress={progress}
      />

      <ToolWorkspaceShell
        isEmpty={images.length === 0}
        empty={
          <>
            <FileDropZone
              onFilesSelected={addFiles}
              accept={ACCEPTED_IMAGE_EXTENSIONS}
              validateFile={isAcceptedImageFile}
              disabled={isBusy}
              label="Drop images here to convert to PDF"
              hint="or click to browse — JPG, JPEG, PNG"
              icon={<ImageToPdfIcon />}
            />
            <PrivacyNotice message={PRIVACY_MESSAGE} />
          </>
        }
        workArea={
          images.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-2.5 border-b border-border/80 bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
                    <ImageToPdfIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {images.length} image{images.length === 1 ? "" : "s"}
                    </p>
                    <p className="truncate text-[11px] text-scanonix-muted">
                      {formatFileSize(totalInputBytes)} · {images.length} PDF
                      page{images.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
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
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg sm:w-auto"
                    disabled={isBusy}
                    onClick={() => addMoreInputRef.current?.click()}
                  >
                    Add more images
                  </ActionButton>
                  <div
                    className={
                      hasResult
                        ? "hidden w-full sm:w-auto md:block"
                        : "w-full sm:w-auto"
                    }
                  >
                    <ActionButton
                      variant="outline"
                      size="sm"
                      className="w-full rounded-lg sm:w-auto"
                      disabled={isBusy}
                      onClick={clearAll}
                    >
                      Start over
                    </ActionButton>
                  </div>
                </div>
              </div>

              <div className="border-b border-border/80 bg-surface px-3 py-2 sm:px-4">
                <p className="text-sm font-semibold text-foreground">
                  PDF page order
                </p>
                <p className="text-[11px] text-scanonix-muted">
                  Each image becomes a PDF page in this order. Drag images to
                  reorder PDF pages.
                </p>
              </div>

              <div className="bg-surface-muted/30 p-3 sm:p-4">
                <ImagePreviewGrid
                  images={images}
                  onRemove={removeImage}
                  onRotate={rotateImage}
                  onReorder={reorderImages}
                  disabled={isBusy}
                />
              </div>
            </div>
          ) : null
        }
        controlPanel={
          images.length > 0 ? (
            <ToolControlPanel
              aria-label="Image to PDF controls"
              footer={
                showResultInspector && pdfBlob ? (
                  <div className="flex flex-col gap-2">
                    <div className="hidden md:block">
                      <ActionButton
                        size="lg"
                        className="w-full"
                        loading={isDownloading}
                        disabled={isBusy}
                        onClick={() => {
                          void handleDownload();
                        }}
                      >
                        Download PDF
                      </ActionButton>
                    </div>
                    <ActionButton
                      variant="outline"
                      size="lg"
                      className="w-full"
                      disabled={isBusy}
                      onClick={handleChangeSettings}
                    >
                      Change settings
                    </ActionButton>
                    <div className="hidden md:block">
                      <ActionButton
                        variant="outline"
                        size="lg"
                        className="w-full"
                        disabled={isBusy}
                        onClick={clearAll}
                      >
                        Start over
                      </ActionButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] leading-snug text-scanonix-muted">
                      {generateHint}
                    </p>
                    <ActionButton
                      size="lg"
                      className="w-full shadow-[var(--shadow-orange-sm)]"
                      loading={status === "loading"}
                      disabled={images.length === 0 || isBusy}
                      onClick={() => {
                        void handleGenerate();
                      }}
                    >
                      {status === "loading" ? "Generating PDF…" : "Generate PDF"}
                    </ActionButton>
                    <ActionButton
                      variant="outline"
                      size="lg"
                      className="w-full"
                      disabled={isBusy}
                      onClick={clearAll}
                    >
                      Start over
                    </ActionButton>
                  </div>
                )
              }
            >
              {showResultInspector && pdfBlob ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Result
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-green-700 dark:text-green-400">
                      ✓ PDF created
                    </p>
                    <p className="mt-1 text-xs text-scanonix-muted">
                      Your PDF is ready to download.
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Pages</dt>
                      <dd className="font-semibold text-foreground">
                        {images.length}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Output size</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(pdfBlob.size)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Page size</dt>
                      <dd className="font-semibold text-foreground">
                        {pageSizeLabel(pageSize)}
                      </dd>
                    </div>
                    {pageSize !== "fit" ? (
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Orientation</dt>
                        <dd className="font-semibold capitalize text-foreground">
                          {orientation}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Format</dt>
                      <dd className="font-semibold text-foreground">PDF</dd>
                    </div>
                    <div className="min-w-0 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Filename</dt>
                      <dd className="mt-0.5 truncate font-semibold text-foreground">
                        {resultFilename}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Image to PDF
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-scanonix-muted">
                      Arrange images, choose page settings, and create one PDF.
                    </p>
                  </div>

                  <section className="space-y-2.5">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Page size
                    </h2>
                    <div className="grid gap-1.5">
                      {PAGE_SIZE_OPTIONS.map((option) => {
                        const selected = pageSize === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={isBusy}
                            aria-pressed={selected}
                            onClick={() => setPageSize(option.value)}
                            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                              selected
                                ? "border-scanonix-orange bg-scanonix-orange/10 ring-2 ring-scanonix-orange/30"
                                : "border-border bg-surface-muted/60 hover:border-scanonix-orange/40"
                            } ${isBusy ? "cursor-not-allowed opacity-50" : ""}`}
                          >
                            <span className="block text-sm font-semibold text-foreground">
                              {option.label}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-scanonix-muted">
                              {option.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {pageSize === "fit" ? (
                      <p className="text-[11px] leading-snug text-scanonix-muted">
                        Each PDF page follows its image size.
                      </p>
                    ) : null}
                  </section>

                  <section className="space-y-2.5 border-t border-border/80 pt-4">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Orientation
                    </h2>
                    <div className="grid grid-cols-2 gap-1.5">
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
                            className={`rounded-lg border px-3 py-2.5 text-center text-sm font-semibold transition-colors ${
                              selected
                                ? "border-scanonix-orange bg-scanonix-orange/10 ring-2 ring-scanonix-orange/30 text-foreground"
                                : "border-border bg-surface-muted/60 text-foreground hover:border-scanonix-orange/40"
                            } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    {pageSize === "fit" ? (
                      <p className="text-[11px] leading-snug text-scanonix-muted">
                        Orientation follows each image when using Fit Image.
                      </p>
                    ) : null}
                  </section>

                  <section className="space-y-2.5 border-t border-border/80 pt-4">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Summary
                    </h2>
                    <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Images</dt>
                        <dd className="font-semibold text-foreground">
                          {images.length}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">PDF pages</dt>
                        <dd className="font-semibold text-foreground">
                          {images.length}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Page size</dt>
                        <dd className="font-semibold text-foreground">
                          {pageSizeLabel(pageSize)}
                        </dd>
                      </div>
                      {pageSize !== "fit" ? (
                        <div className="flex justify-between gap-3 px-3 py-2.5">
                          <dt className="text-scanonix-muted">Orientation</dt>
                          <dd className="font-semibold capitalize text-foreground">
                            {orientation}
                          </dd>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Input size</dt>
                        <dd className="font-semibold text-foreground">
                          {formatFileSize(totalInputBytes)}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="space-y-2 border-t border-border/80 pt-4">
                    <PrivacyNotice message={PRIVACY_MESSAGE} />
                  </section>
                </div>
              )}
            </ToolControlPanel>
          ) : null
        }
      />

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
